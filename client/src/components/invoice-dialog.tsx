import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { invoicePayloadSchema, type Invoice, type Customer, type InvoiceLineItem } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useTenant } from "@/hooks/useTenant";
import { Plus, Trash2, Loader2 } from "lucide-react";

const safeParseFloat = (value: string | number | null | undefined): number => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
};

const decimalString = z.string().refine(
  (val) => {
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed > 0;
  },
  { message: "Must be greater than 0" }
);

const formSchema = z.object({
  invoice: z.object({
    tenantId: z.string(),
    customerId: z.string().min(1, "Customer is required"),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    status: z.string(),
    subtotal: z.string(),
    taxAmount: z.string(),
    total: z.string(),
    notes: z.string().optional(),
  }),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: decimalString,
    unitPrice: decimalString,
    amount: z.string(),
    accountId: z.string().nullable().optional(),
  })).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function InvoiceDialog({ open, onOpenChange, invoice }: InvoiceDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const { data: lineItems, isLoading: lineItemsLoading } = useQuery<InvoiceLineItem[]>({
    queryKey: ["/api/invoices", invoice?.id, "line-items", currentTenant?.id],
    queryFn: async () => {
      if (!invoice?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/invoices/${invoice.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!invoice?.id && !!currentTenant?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoice: {
        tenantId: currentTenant?.id || "",
        customerId: "",
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "draft",
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "0.00",
        notes: "",
      },
      lineItems: [{
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        amount: "0.00",
        accountId: null,
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  // Use useWatch to watch form values without causing side effects
  const watchedLineItems = useWatch({
    control: form.control,
    name: "lineItems",
  });

  const watchedTaxAmount = useWatch({
    control: form.control,
    name: "invoice.taxAmount",
  });

  // Calculate amounts and totals using useMemo to avoid recursion
  const calculatedValues = useMemo(() => {
    const lineItems = watchedLineItems || [];
    
    // Calculate individual line item amounts
    const itemsWithCalculatedAmounts = lineItems.map((item) => {
      if (!item) return { amount: "0.00" };
      const qty = safeParseFloat(item.quantity);
      const price = safeParseFloat(item.unitPrice);
      const amount = (qty * price).toFixed(2);
      return { amount };
    });

    // Calculate subtotal
    const subtotal = itemsWithCalculatedAmounts.reduce((sum, item) => {
      return sum + safeParseFloat(item.amount);
    }, 0);
    
    // Calculate total
    const taxAmount = safeParseFloat(watchedTaxAmount);
    const total = subtotal + taxAmount;

    return {
      itemsWithCalculatedAmounts,
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
    };
  }, [watchedLineItems, watchedTaxAmount]);

  // Update form values when calculated values change
  useEffect(() => {
    calculatedValues.itemsWithCalculatedAmounts.forEach((item, index) => {
      const currentAmount = form.getValues(`lineItems.${index}.amount`);
      if (currentAmount !== item.amount) {
        form.setValue(`lineItems.${index}.amount`, item.amount, { shouldValidate: false });
      }
    });

    const currentSubtotal = form.getValues('invoice.subtotal');
    const currentTotal = form.getValues('invoice.total');
    
    if (currentSubtotal !== calculatedValues.subtotal) {
      form.setValue('invoice.subtotal', calculatedValues.subtotal, { shouldValidate: false });
    }
    
    if (currentTotal !== calculatedValues.total) {
      form.setValue('invoice.total', calculatedValues.total, { shouldValidate: false });
    }
  }, [calculatedValues, form]);

  // Reset form when editing and line items have loaded
  useEffect(() => {
    if (!open || !invoice || lineItemsLoading || !lineItems) return;
    
    form.reset({
      invoice: {
        tenantId: invoice.tenantId,
        customerId: invoice.customerId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
        dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
        status: invoice.status,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        notes: invoice.notes || "",
      },
      lineItems: lineItems.length > 0 ? lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        accountId: item.accountId || null,
      })) : [{
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        amount: "0.00",
        accountId: null,
      }],
    });
  }, [invoice, lineItems, lineItemsLoading, form, open]);

  // Reset form immediately when creating new invoice
  useEffect(() => {
    if (!open || invoice) return;
    
    form.reset({
      invoice: {
        tenantId: currentTenant?.id || "",
        customerId: "",
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "draft",
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "0.00",
        notes: "",
      },
      lineItems: [{
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        amount: "0.00",
        accountId: null,
      }],
    });
  }, [invoice, currentTenant, form, open]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        tenantId: currentTenant?.id,
        invoice: {
          tenantId: values.invoice.tenantId,
          customerId: values.invoice.customerId,
          invoiceNumber: values.invoice.invoiceNumber,
          invoiceDate: new Date(values.invoice.invoiceDate).toISOString(),
          dueDate: new Date(values.invoice.dueDate).toISOString(),
          status: values.invoice.status,
          subtotal: values.invoice.subtotal,
          taxAmount: values.invoice.taxAmount,
          total: values.invoice.total,
          notes: values.invoice.notes || "",
        },
        lineItems: values.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          accountId: item.accountId || null,
        })),
      };

      if (invoice) {
        return await apiRequest("PATCH", `/api/invoices/${invoice.id}`, payload);
      }
      return await apiRequest("POST", "/api/invoices", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: invoice ? "Invoice updated" : "Invoice created",
        description: `Invoice has been ${invoice ? "updated" : "created"} successfully.`,
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
        description: `Failed to ${invoice ? "update" : "create"} invoice.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    const hasNaN = 
      isNaN(safeParseFloat(values.invoice.subtotal)) ||
      isNaN(safeParseFloat(values.invoice.taxAmount)) ||
      isNaN(safeParseFloat(values.invoice.total)) ||
      values.lineItems.some(item => 
        isNaN(safeParseFloat(item.quantity)) ||
        isNaN(safeParseFloat(item.unitPrice)) ||
        isNaN(safeParseFloat(item.amount))
      );

    if (hasNaN) {
      toast({
        title: "Invalid Data",
        description: "Please ensure all numeric fields have valid values.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto" data-testid="dialog-invoice">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {invoice ? "Update invoice information" : "Create a new invoice for your customer"}
          </DialogDescription>
        </DialogHeader>
        {lineItemsLoading && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground" data-testid="loading-indicator">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading invoice details...</span>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoice.customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-customer">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice.invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-001" {...field} data-testid="input-invoice-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="invoice.invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-invoice-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice.dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-due-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice.status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Line Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({
                    description: "",
                    quantity: "1",
                    unitPrice: "0.00",
                    amount: "0.00",
                    accountId: null,
                  })}
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start border rounded-md p-3">
                    <div className="col-span-5">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel>Description *</FormLabel>}
                            <FormControl>
                              <Input placeholder="Item description" {...field} data-testid={`input-description-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel>Qty *</FormLabel>}
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="1" {...field} data-testid={`input-quantity-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel>Price *</FormLabel>}
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid={`input-unit-price-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel>Amount</FormLabel>}
                            <FormControl>
                              <Input readOnly {...field} className="bg-muted" data-testid={`text-amount-${index}`} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="text-destructive"
                          data-testid={`button-remove-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-end gap-4">
                <span className="text-sm">Subtotal:</span>
                <span className="font-mono font-semibold" data-testid="text-subtotal">${form.watch('invoice.subtotal')}</span>
              </div>
              <div className="flex justify-end gap-4 items-center">
                <FormField
                  control={form.control}
                  name="invoice.taxAmount"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormLabel className="text-sm">Tax:</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="w-24 h-8" 
                          {...field} 
                          data-testid="input-tax-amount"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-lg font-mono font-bold" data-testid="text-total">${form.watch('invoice.total')}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="invoice.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || lineItemsLoading} data-testid="button-save">
                {saveMutation.isPending ? "Saving..." : lineItemsLoading ? "Loading..." : (invoice ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
