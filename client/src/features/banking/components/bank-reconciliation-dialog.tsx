import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  bankReconciliationPayloadSchema, 
  type BankReconciliation, 
  type Account,
  type JournalEntry,
  type BankReconciliationItem
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { useTenant } from "@/shared/hooks/useTenant";
import { Plus, Trash2, Loader2 } from "lucide-react";

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
};

const decimalString = z.string().refine(
  (val) => {
    if (val === '' || val === '0' || val === '0.00') return true;
    const parsed = parseFloat(val);
    return !isNaN(parsed);
  },
  { message: "Must be a valid number" }
);

const formSchema = z.object({
  reconciliation: z.object({
    tenantId: z.string(),
    accountId: z.string().min(1, "Bank account is required"),
    reconciliationDate: z.string().min(1, "Reconciliation date is required"),
    statementDate: z.string().min(1, "Statement date is required"),
    statementBalance: decimalString,
    bookBalance: decimalString,
    difference: decimalString,
    status: z.string(),
    notes: z.string().optional(),
  }),
  items: z.array(z.object({
    transactionDate: z.string().min(1, "Transaction date is required"),
    description: z.string().optional(),
    amount: decimalString,
    isMatched: z.boolean().default(false),
    journalEntryId: z.string().nullable().optional(),
  })),
});

type FormValues = z.infer<typeof formSchema>;

interface BankReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliation: BankReconciliation | null;
}

export function BankReconciliationDialog({ open, onOpenChange, reconciliation }: BankReconciliationDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: journalEntries = [] } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: items, isLoading: itemsLoading } = useQuery<BankReconciliationItem[]>({
    queryKey: [`/api/bank-reconciliations/${reconciliation?.id}/items`, { tenantId: currentTenant?.id }],
    enabled: !!reconciliation?.id && !!currentTenant?.id && open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reconciliation: {
        tenantId: currentTenant?.id || "",
        accountId: "",
        reconciliationDate: new Date().toISOString().split('T')[0],
        statementDate: new Date().toISOString().split('T')[0],
        statementBalance: "0.00",
        bookBalance: "0.00",
        difference: "0.00",
        status: "in_progress",
        notes: "",
      },
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedStatementBalance = useWatch({
    control: form.control,
    name: "reconciliation.statementBalance",
  });

  const watchedBookBalance = useWatch({
    control: form.control,
    name: "reconciliation.bookBalance",
  });

  const watchedItems = useWatch({
    control: form.control,
    name: "items",
  });

  // Reinitialize form when tenant data loads (for new reconciliations)
  useEffect(() => {
    if (!open || reconciliation) return;
    if (!currentTenant) return;
    
    const currentValues = form.getValues();
    if (currentValues.reconciliation.tenantId !== currentTenant.id) {
      form.setValue("reconciliation.tenantId", currentTenant.id);
    }
  }, [open, reconciliation, currentTenant, form]);

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    
    if (reconciliation && currentTenant) {
      form.reset({
        reconciliation: {
          tenantId: currentTenant.id,
          accountId: reconciliation.accountId,
          reconciliationDate: new Date(reconciliation.reconciliationDate).toISOString().split('T')[0],
          statementDate: new Date(reconciliation.statementDate).toISOString().split('T')[0],
          statementBalance: reconciliation.statementBalance.toString(),
          bookBalance: reconciliation.bookBalance.toString(),
          difference: reconciliation.difference.toString(),
          status: reconciliation.status,
          notes: reconciliation.notes || "",
        },
        items: items?.map(item => ({
          transactionDate: new Date(item.transactionDate).toISOString().split('T')[0],
          description: item.description || "",
          amount: item.amount.toString(),
          isMatched: item.isMatched,
          journalEntryId: item.journalEntryId || null,
        })) || [],
      });
    } else if (currentTenant) {
      form.reset({
        reconciliation: {
          tenantId: currentTenant.id,
          accountId: "",
          reconciliationDate: new Date().toISOString().split('T')[0],
          statementDate: new Date().toISOString().split('T')[0],
          statementBalance: "0.00",
          bookBalance: "0.00",
          difference: "0.00",
          status: "in_progress",
          notes: "",
        },
        items: [],
      });
    }
  }, [open, reconciliation, items, currentTenant, form]);

  // Auto-calculate difference when balances change
  useEffect(() => {
    const statement = safeParseFloat(watchedStatementBalance);
    const book = safeParseFloat(watchedBookBalance);
    const diff = statement - book;
    
    form.setValue("reconciliation.difference", diff.toFixed(2), { shouldValidate: false });
  }, [watchedStatementBalance, watchedBookBalance, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const payload = {
        reconciliation: {
          ...data.reconciliation,
          tenantId: currentTenant.id,
        },
        items: data.items.map(item => ({
          ...item,
          reconciliationId: reconciliation?.id,
        })),
      };

      const url = reconciliation
        ? `/api/bank-reconciliations/${reconciliation.id}?tenantId=${currentTenant.id}`
        : `/api/bank-reconciliations?tenantId=${currentTenant.id}`;
      
      const method = reconciliation ? "PATCH" : "POST";
      
      const response = await apiRequest(url, method, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-reconciliations", { tenantId: currentTenant?.id }] });
      toast({
        title: reconciliation ? "Reconciliation updated" : "Reconciliation created",
        description: reconciliation 
          ? "Bank reconciliation has been updated successfully."
          : "Bank reconciliation has been created successfully.",
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
        description: error.message || "Failed to save bank reconciliation.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  // Filter accounts to only show bank/cash accounts
  const bankAccounts = useMemo(() => {
    return accounts.filter(account => 
      account.type === 'asset' && 
      (account.accountCategory?.toLowerCase().includes('bank') || 
       account.accountCategory?.toLowerCase().includes('cash') ||
       account.subtype?.toLowerCase().includes('bank') ||
       account.subtype?.toLowerCase().includes('cash'))
    );
  }, [accounts]);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const unmatchedCount = useMemo(() => {
    return watchedItems?.filter(item => !item.isMatched).length || 0;
  }, [watchedItems]);

  const totalAmount = useMemo(() => {
    return watchedItems?.reduce((sum, item) => sum + safeParseFloat(item.amount), 0) || 0;
  }, [watchedItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {reconciliation ? "Edit Bank Reconciliation" : "New Bank Reconciliation"}
          </DialogTitle>
          <DialogDescription>
            Reconcile your bank account with journal entries
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" data-testid="tab-details">Basic Details</TabsTrigger>
                <TabsTrigger value="items" data-testid="tab-items">
                  Items {unmatchedCount > 0 && <span className="ml-1 text-xs">({unmatchedCount} unmatched)</span>}
                </TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="reconciliation.accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-account">
                            <SelectValue placeholder="Select bank account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankAccounts.map((account) => (
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reconciliation.reconciliationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reconciliation Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-reconciliation-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reconciliation.statementDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statement Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-statement-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reconciliation.statementBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statement Balance</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                            data-testid="input-statement-balance" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reconciliation.bookBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Book Balance</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                            data-testid="input-book-balance" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reconciliation.difference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difference (Calculated)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          disabled 
                          className="font-mono"
                          data-testid="input-difference" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reconciliation.status"
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
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reconciliation.notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add any notes about this reconciliation..."
                          {...field} 
                          data-testid="textarea-notes" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="items" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4" data-testid={`item-${index}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Item {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          data-testid={`button-remove-item-${index}`}
                          aria-label={`Remove reconciliation item ${index + 1}`}
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.transactionDate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Transaction Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid={`input-transaction-date-${index}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  {...field} 
                                  data-testid={`input-amount-${index}`} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid={`input-description-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.isMatched`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid={`checkbox-is-matched-${index}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Is Matched
                              </FormLabel>
                            </FormItem>
                          )}
                        />

                        {watchedItems?.[index]?.isMatched && (
                          <FormField
                            control={form.control}
                            name={`items.${index}.journalEntryId`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Journal Entry</FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  value={field.value || ""}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid={`select-journal-entry-${index}`}>
                                      <SelectValue placeholder="Select journal entry" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {journalEntries.map((entry) => (
                                      <SelectItem key={entry.id} value={entry.id}>
                                        {entry.journalEntryNumber} - {entry.description}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({
                      transactionDate: new Date().toISOString().split('T')[0],
                      description: "",
                      amount: "0.00",
                      isMatched: false,
                      journalEntryId: null,
                    })}
                    className="w-full"
                    data-testid="button-add-item"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4 mt-4">
                <div className="space-y-4 p-6 border rounded-lg">
                  <h3 className="text-lg font-semibold">Reconciliation Summary</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Statement Balance:</span>
                      <span className="font-mono font-medium" data-testid="summary-statement-balance">
                        {formatCurrency(watchedStatementBalance || 0)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Book Balance:</span>
                      <span className="font-mono font-medium" data-testid="summary-book-balance">
                        {formatCurrency(watchedBookBalance || 0)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Difference:</span>
                      <span 
                        className={`font-mono font-semibold ${
                          Math.abs(safeParseFloat(watchedStatementBalance) - safeParseFloat(watchedBookBalance)) < 0.01
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                        data-testid="summary-difference"
                      >
                        {formatCurrency(safeParseFloat(watchedStatementBalance) - safeParseFloat(watchedBookBalance))}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <h4 className="font-medium">Items Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Items:</span>
                      <span data-testid="summary-total-items">{watchedItems?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Matched Items:</span>
                      <span data-testid="summary-matched-items">
                        {watchedItems?.filter(item => item.isMatched).length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unmatched Items:</span>
                      <span className="text-red-600 dark:text-red-400" data-testid="summary-unmatched-items">
                        {unmatchedCount}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-mono" data-testid="summary-total-amount">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

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
                disabled={createMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {reconciliation ? "Update" : "Create"} Reconciliation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
