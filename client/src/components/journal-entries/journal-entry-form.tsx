/**
 * Journal Entry Form Component
 * 
 * CRITICAL: All financial calculations are done server-side
 * This component provides UI validation and real-time balance display
 * but final validation happens on the server
 */

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/shared/components/ui/card";
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
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { useTenant } from "@/shared/hooks/useTenant";
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Calculator,
  FileText,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils/utils";

// Helper to safely parse float values
const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
};

// Decimal string validation for Zod
const decimalString = z.string().refine(
  (val) => {
    if (val === '' || val === '0' || val === '0.00') return true;
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed >= 0;
  },
  { message: "Must be a valid positive number" }
);

// Form schema with comprehensive validation
const formSchema = z.object({
  journalEntry: z.object({
    tenantId: z.string(),
    entryDate: z.string().min(1, "Entry date is required"),
    entryNumber: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    notes: z.string().optional(),
    status: z.enum(['draft', 'posted']).default('draft'),
    sourceType: z.string().optional(),
    sourceId: z.string().optional(),
  }),
  legs: z.array(z.object({
    accountId: z.string().min(1, "Account is required"),
    type: z.enum(['Debit', 'Credit']),
    amount: decimalString,
    description: z.string().optional(),
  })).min(2, "At least two line items are required for double-entry")
});

type FormValues = z.infer<typeof formSchema>;

interface JournalEntryFormProps {
  journalEntry?: JournalEntry | null;
  onSuccess?: (entry: JournalEntry) => void;
  onCancel?: () => void;
}

interface BalanceState {
  totalDebits: number;
  totalCredits: number;
  imbalance: number;
  isBalanced: boolean;
}

export function JournalEntryForm({ 
  journalEntry, 
  onSuccess, 
  onCancel 
}: JournalEntryFormProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [balance, setBalance] = useState<BalanceState>({
    totalDebits: 0,
    totalCredits: 0,
    imbalance: 0,
    isBalanced: true
  });

  // Fetch accounts for selection
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  // Group accounts by type for better UX
  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.accountType || 'Other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  // Form setup
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      journalEntry: {
        tenantId: currentTenant?.id || "",
        entryDate: new Date().toISOString().split('T')[0],
        entryNumber: "",
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

  // Field array for dynamic line items
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "legs",
  });

  // Watch legs for balance calculation
  const watchedLegs = useWatch({
    control: form.control,
    name: "legs",
  });

  // Calculate balance whenever legs change
  useEffect(() => {
    if (!watchedLegs) return;

    let totalDebits = 0;
    let totalCredits = 0;

    watchedLegs.forEach(leg => {
      const amount = safeParseFloat(leg.amount);
      if (leg.type === 'Debit') {
        totalDebits += amount;
      } else {
        totalCredits += amount;
      }
    });

    const imbalance = Math.abs(totalDebits - totalCredits);
    const isBalanced = imbalance < 0.01; // Allow tiny rounding differences

    setBalance({
      totalDebits,
      totalCredits,
      imbalance,
      isBalanced
    });
  }, [watchedLegs]);

  // Load existing journal entry data
  useEffect(() => {
    if (journalEntry) {
      form.reset({
        journalEntry: {
          tenantId: journalEntry.tenantId,
          entryDate: journalEntry.entryDate,
          entryNumber: journalEntry.entryNumber || "",
          description: journalEntry.description || "",
          notes: journalEntry.notes || "",
          status: journalEntry.status as 'draft' | 'posted',
        },
        legs: [], // Will be loaded separately
      });
    }
  }, [journalEntry, form]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        legs: data.legs.map(leg => ({
          ...leg,
          debit: leg.type === 'Debit' ? leg.amount : null,
          credit: leg.type === 'Credit' ? leg.amount : null,
        }))
      };

      if (journalEntry?.id) {
        return apiRequest(`/api/journal-entries/${journalEntry.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        return apiRequest('/api/journal-entries', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: journalEntry 
          ? "Journal entry updated successfully" 
          : "Journal entry created successfully",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["/api/journal-entries"],
      });
      
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/journal-entries/${data.id}`],
        });
      }
      
      onSuccess?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save journal entry",
        variant: "destructive",
      });
    },
  });

  // Post journal entry mutation
  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/journal-entries/${id}/post`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Posted",
        description: "Journal entry has been posted successfully",
      });
      
      queryClient.invalidateQueries({
        queryKey: ["/api/journal-entries"],
      });
      
      onSuccess?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.error || error.message || "Failed to post journal entry",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormValues) => {
    // Check balance before submitting
    if (!balance.isBalanced) {
      toast({
        title: "Validation Error",
        description: "Journal entry must be balanced. Debits must equal credits.",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(data);
  };

  const handleAddLine = () => {
    append({
      accountId: "",
      type: fields.length % 2 === 0 ? "Debit" : "Credit", // Alternate types
      amount: "0.00",
      description: "",
    });
  };

  const handlePostEntry = () => {
    if (!journalEntry?.id) return;
    
    if (!balance.isBalanced) {
      toast({
        title: "Cannot Post",
        description: "Journal entry must be balanced before posting.",
        variant: "destructive",
      });
      return;
    }

    postMutation.mutate(journalEntry.id);
  };

  // Check if entry can be edited
  const isEditable = !journalEntry || journalEntry.status === 'draft';
  const isPosted = journalEntry?.status === 'posted';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {journalEntry ? 'Edit Journal Entry' : 'New Journal Entry'}
          </CardTitle>
          {journalEntry && (
            <Badge variant={isPosted ? "secondary" : "default"}>
              {journalEntry.status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Entry Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="journalEntry.entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={!isEditable}
                        data-testid="input-entry-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="journalEntry.entryNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Auto-generated if empty"
                        disabled={!isEditable}
                        data-testid="input-entry-number"
                      />
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
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter journal entry description"
                      disabled={!isEditable}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="journalEntry.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes (optional)"
                      disabled={!isEditable}
                      rows={3}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Balance Display */}
            <Alert className={cn(
              "transition-colors",
              balance.isBalanced 
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" 
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
            )}>
              <div className="flex items-start gap-2">
                {balance.isBalanced ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertTitle>
                    {balance.isBalanced ? 'Balanced' : 'Unbalanced'}
                  </AlertTitle>
                  <AlertDescription className="mt-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1">
                        <ArrowUpCircle className="h-4 w-4" />
                        Total Debits:
                      </span>
                      <span className="font-mono font-medium">
                        ${balance.totalDebits.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1">
                        <ArrowDownCircle className="h-4 w-4" />
                        Total Credits:
                      </span>
                      <span className="font-mono font-medium">
                        ${balance.totalCredits.toFixed(2)}
                      </span>
                    </div>
                    {!balance.isBalanced && (
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="font-medium">Imbalance:</span>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">
                          ${balance.imbalance.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Line Items</h3>
                {isEditable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddLine}
                    data-testid="button-add-line"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* Account Selection */}
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.accountId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={!isEditable}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-account-${index}`}>
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.entries(groupedAccounts).map(([type, accts]) => (
                                    <div key={type}>
                                      <div className="px-2 py-1 text-sm font-medium text-gray-500">
                                        {type}
                                      </div>
                                      {accts.map((account) => (
                                        <SelectItem
                                          key={account.id}
                                          value={account.id}
                                        >
                                          {account.code} - {account.name}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Type Selection */}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                disabled={!isEditable}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-type-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Debit">
                                    <span className="flex items-center gap-1">
                                      <ArrowUpCircle className="h-3 w-3" />
                                      Debit
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="Credit">
                                    <span className="flex items-center gap-1">
                                      <ArrowDownCircle className="h-3 w-3" />
                                      Credit
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Amount */}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="pl-8"
                                    placeholder="0.00"
                                    disabled={!isEditable}
                                    data-testid={`input-amount-${index}`}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Description */}
                      <div className="md:col-span-3">
                        <FormField
                          control={form.control}
                          name={`legs.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Line description"
                                  disabled={!isEditable}
                                  data-testid={`input-line-description-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Delete Button */}
                      {isEditable && fields.length > 2 && (
                        <div className="md:col-span-1 flex items-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(index)}
                            className="text-red-600 hover:text-red-700"
                            data-testid={`button-delete-line-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {journalEntry?.id && journalEntry.status === 'draft' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePostEntry}
                  disabled={!balance.isBalanced || postMutation.isPending}
                  data-testid="button-post-entry"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Post Entry
                </Button>
              )}

              {isEditable && (
                <Button
                  type="submit"
                  disabled={mutation.isPending || !balance.isBalanced}
                  data-testid="button-submit"
                >
                  <Calculator className="h-4 w-4 mr-1" />
                  {mutation.isPending 
                    ? 'Saving...' 
                    : journalEntry 
                      ? 'Update Entry' 
                      : 'Create Entry'}
                </Button>
              )}
            </div>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}