import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  journalEntryPayloadSchema,
  type JournalEntry,
  type JournalEntryLeg,
  type Account,
} from "@shared/schema";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { useTenant } from "@/shared/hooks/useTenant";
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
};

const decimalString = z.string().refine(
  (val) => {
    if (val === '' || val === '0' || val === '0.00') return true;
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed >= 0;
  },
  { message: "Must be a valid number" }
);

const formSchema = z.object({
  journalEntry: z.object({
    tenantId: z.string(),
    entryDate: z.string().min(1, "Entry date is required"),
    referenceNumber: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['draft', 'posted']),
  }),
  legs: z.array(z.object({
    accountId: z.string().min(1, "Account is required"),
    type: z.enum(['Debit', 'Credit']),
    amount: decimalString,
    description: z.string().optional(),
  })).min(2, "At least two legs are required for double-entry"),
});

type FormValues = z.infer<typeof formSchema>;

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalEntry: JournalEntry | null;
}

export function JournalEntryDialog({ open, onOpenChange, journalEntry }: JournalEntryDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: legs, isLoading: legsLoading } = useQuery<JournalEntryLeg[]>({
    queryKey: [`/api/journal-entries/${journalEntry?.id}/legs`, { tenantId: currentTenant?.id }],
    enabled: !!journalEntry?.id && !!currentTenant?.id && open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      journalEntry: {
        tenantId: currentTenant?.id || "",
        entryDate: new Date().toISOString().split('T')[0],
        referenceNumber: "",
        description: "",
        notes: "",
        status: "draft",
      },
      legs: [
        {
          accountId: "",
          type: "Debit",
          amount: "0.00",
          description: "",
        },
        {
          accountId: "",
          type: "Credit",
          amount: "0.00",
          description: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "legs",
  });

  const watchedLegs = useWatch({
    control: form.control,
    name: "legs",
  });

  // Calculate balance totals
  const balanceInfo = useMemo(() => {
    const debits = watchedLegs
      .filter(leg => leg.type === 'Debit')
      .reduce((sum, leg) => sum + safeParseFloat(leg.amount), 0);
    
    const credits = watchedLegs
      .filter(leg => leg.type === 'Credit')
      .reduce((sum, leg) => sum + safeParseFloat(leg.amount), 0);
    
    const difference = Math.abs(debits - credits);
    const isBalanced = difference < 0.01;

    return { debits, credits, difference, isBalanced };
  }, [watchedLegs]);

  useEffect(() => {
    if (journalEntry) {
      form.reset({
        journalEntry: {
          tenantId: currentTenant?.id || "",
          entryDate: journalEntry.entryDate ? new Date(journalEntry.entryDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          referenceNumber: journalEntry.referenceNumber || "",
          description: journalEntry.description || "",
          notes: journalEntry.notes || "",
          status: journalEntry.status as 'draft' | 'posted',
        },
        legs: [],
      });
    } else {
      form.reset({
        journalEntry: {
          tenantId: currentTenant?.id || "",
          entryDate: new Date().toISOString().split('T')[0],
          referenceNumber: "",
          description: "",
          notes: "",
          status: "draft",
        },
        legs: [
          {
            accountId: "",
            type: "Debit",
            amount: "0.00",
            description: "",
          },
          {
            accountId: "",
            type: "Credit",
            amount: "0.00",
            description: "",
          },
        ],
      });
    }
  }, [journalEntry, currentTenant?.id, form]);

  useEffect(() => {
    if (legs && legs.length > 0) {
      form.setValue('legs', legs.map(leg => ({
        accountId: leg.accountId,
        type: leg.type as 'Debit' | 'Credit',
        amount: leg.amount,
        description: leg.description || "",
      })));
    }
  }, [legs, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const payload = {
        journalEntry: {
          tenantId: currentTenant.id,
          entryDate: new Date(values.journalEntry.entryDate).toISOString(),
          referenceNumber: values.journalEntry.referenceNumber,
          description: values.journalEntry.description,
          notes: values.journalEntry.notes,
          status: values.journalEntry.status,
        },
        legs: values.legs.map(leg => ({
          accountId: leg.accountId,
          type: leg.type,
          amount: leg.amount,
          description: leg.description,
        })),
      };

      if (journalEntry) {
        return await apiRequest(
          `/api/journal-entries/${journalEntry.id}?tenantId=${currentTenant.id}`,
          "PATCH",
          payload
        );
      }
      return await apiRequest(
        `/api/journal-entries?tenantId=${currentTenant.id}`,
        "POST",
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries", { tenantId: currentTenant?.id }] });
      toast({
        title: journalEntry ? "Journal entry updated" : "Journal entry created",
        description: `Journal entry has been ${journalEntry ? "updated" : "created"} successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || `Failed to ${journalEntry ? "update" : "create"} journal entry.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-journal-entry">
        <DialogHeader>
          <DialogTitle>{journalEntry ? "Edit Journal Entry" : "Create Journal Entry"}</DialogTitle>
          <DialogDescription>
            {journalEntry ? "Update journal entry details" : "Create a new journal entry with debit and credit legs"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="journalEntry.entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-entry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="journalEntry.referenceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional reference" {...field} data-testid="input-reference-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="journalEntry.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Entry description" 
                      {...field} 
                      data-testid="input-description"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="journalEntry.status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Journal Entry Legs</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({
                    accountId: "",
                    type: "Debit",
                    amount: "0.00",
                    description: "",
                  })}
                  data-testid="button-add-leg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Leg
                </Button>
              </div>

              {!balanceInfo.isBalanced && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Balance Warning</AlertTitle>
                  <AlertDescription>
                    Debits and credits must be equal. Current difference: {formatCurrency(balanceInfo.difference)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-muted p-3 font-medium text-sm">
                  <div className="col-span-4">Account</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-3">Description</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                
                <div className="divide-y">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 p-3" data-testid={`leg-row-${index}`}>
                      <div className="col-span-4">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.accountId`}
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-account-${index}`}>
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.code} - {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-type-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Debit">Debit</SelectItem>
                                  <SelectItem value="Credit">Credit</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  {...field}
                                  data-testid={`input-amount-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Description"
                                  {...field}
                                  data-testid={`input-leg-description-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 2}
                          data-testid={`button-remove-leg-${index}`}
                          aria-label={`Remove journal entry leg ${index + 1}`}
                          title="Remove leg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Debits</div>
                    <div className="text-lg font-semibold" data-testid="text-total-debits">
                      {formatCurrency(balanceInfo.debits)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Credits</div>
                    <div className="text-lg font-semibold" data-testid="text-total-credits">
                      {formatCurrency(balanceInfo.credits)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Difference</div>
                    <div 
                      className={`text-lg font-semibold ${balanceInfo.isBalanced ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
                      data-testid="text-difference"
                    >
                      {formatCurrency(balanceInfo.difference)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="journalEntry.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes" 
                      {...field} 
                      data-testid="input-notes"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || !balanceInfo.isBalanced}
                data-testid="button-save"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {journalEntry ? "Update" : "Create"} Entry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
