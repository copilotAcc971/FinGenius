import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertCustomerPaymentSchema, type CustomerPayment, type Customer, type Invoice, type Currency } from "@shared/schema";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency-utils";
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

const paymentFormSchema = insertCustomerPaymentSchema.omit({ tenantId: true }).extend({
  paymentDate: z.string().min(1, "Payment date is required"),
  currencyCode: z.string().length(3, "Currency code must be 3 characters").min(1, "Currency is required"),
});
type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface CustomerPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: CustomerPayment | null;
}

export function CustomerPaymentDialog({ open, onOpenChange, payment }: CustomerPaymentDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
  });

  // Currency variables
  const activeCurrencies = currencies.filter(c => c.isActive);
  const baseCurrency = currencies.find(c => c.isBaseCurrency);

  // availableCurrencies with useMemo (seeded pattern)
  const availableCurrencies = useMemo(() => {
    // If editing payment and currencies not loaded yet, create placeholder
    if (payment?.currencyCode && currencies.length === 0) {
      return [{
        code: payment.currencyCode,
        name: payment.currencyCode,
        symbol: payment.currencyCode,
        isActive: false,
        decimalPlaces: 2,
        isBaseCurrency: false,
        tenantId: currentTenant?.id || '',
        id: 'placeholder'
      }];
    }
    
    // Start with all active currencies
    const available = [...activeCurrencies];
    
    // Add ALL inactive currencies (not just payment's currency)
    const inactiveCurrencies = currencies.filter(c => !c.isActive);
    for (const inactive of inactiveCurrencies) {
      if (!available.find(c => c.code === inactive.code)) {
        available.push(inactive);
      }
    }
    
    // Sort: active currencies first (alphabetically), then inactive
    return available.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.code.localeCompare(b.code);
    });
  }, [activeCurrencies, currencies, payment?.currencyCode, currentTenant?.id]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(payment ? paymentFormSchema.partial() : paymentFormSchema),
    defaultValues: {
      customerId: "",
      invoiceId: null,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: "0.00",
      currencyCode: "USD",
      paymentMethod: "cash",
      referenceNumber: "",
      notes: "",
    },
  });

  const watchedCustomerId = form.watch("customerId");

  // Watch currency for invoice display
  const selectedCurrencyCode = useWatch({ control: form.control, name: "currencyCode" });

  useEffect(() => {
    if (payment) {
      form.reset({
        customerId: payment.customerId,
        invoiceId: payment.invoiceId || null,
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        amount: payment.amount,
        currencyCode: payment.currencyCode,
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber || "",
        notes: payment.notes || "",
      });
    } else {
      form.reset({
        customerId: "",
        invoiceId: null,
        paymentDate: new Date().toISOString().split('T')[0],
        amount: "0.00",
        currencyCode: baseCurrency?.code || "USD",
        paymentMethod: "cash",
        referenceNumber: "",
        notes: "",
      });
    }
  }, [payment, baseCurrency, form]);

  // CRITICAL: Guarded form reset (prevents data corruption)
  // Only runs for NEW payments, NEVER when editing
  useEffect(() => {
    if (!open || payment) return; // Only for new payments - prevents corruption
    if (currenciesLoading) return; // Wait for currencies to load
    
    // Reset form with loaded data while preserving any user edits
    const currentValues = form.getValues();
    form.reset({
      ...currentValues,
      currencyCode: baseCurrency?.code || "USD",
    });
  }, [open, payment, currenciesLoading, baseCurrency, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      const payload = {
        ...data,
        paymentDate: new Date(data.paymentDate).toISOString(),
      };
      if (payment) {
        return apiRequest(`/api/customer-payments/${payment.id}`, "PATCH", payload);
      } else {
        return apiRequest("/api/customer-payments", "POST", { ...payload, tenantId: currentTenant?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments", currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", currentTenant?.id] });
      toast({
        title: payment ? "Payment updated" : "Payment recorded",
        description: `Payment has been ${payment ? "updated" : "recorded"} successfully.`,
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
        description: `Failed to ${payment ? "update" : "record"} payment.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: PaymentFormValues) => {
    saveMutation.mutate(values);
  };

  const customerInvoices = invoices.filter(inv => 
    inv.customerId === watchedCustomerId && 
    inv.status !== "paid" && 
    inv.status !== "cancelled"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-customer-payment">
        <DialogHeader>
          <DialogTitle>{payment ? "Edit Payment" : "Record Payment"}</DialogTitle>
          <DialogDescription>
            {payment ? "Update payment information" : "Record a payment received from a customer"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customerId"
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
                        <SelectItem key={customer.id} value={customer.id} data-testid={`select-customer-${customer.id}`}>
                          {customer.displayName || customer.name}
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
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice (Optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-invoice">
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No specific invoice</SelectItem>
                      {customerInvoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id} data-testid={`select-invoice-${invoice.id}`}>
                          {invoice.invoiceNumber} - {formatCurrency(
                            parseFloat(invoice.total || "0"),
                            invoice.currencyCode,
                            currencies
                          )}
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
              name="currencyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-currency" disabled={currenciesLoading}>
                        <SelectValue placeholder="Loading currencies..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableCurrencies.map(currency => (
                        <SelectItem 
                          key={currency.code} 
                          value={currency.code}
                          data-testid={`option-currency-${currency.code}`}
                        >
                          {currency.code} - {currency.name} ({currency.symbol})
                          {!currency.isActive && ' (Inactive)'}
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
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-payment-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="0.00" 
                      {...field} 
                      data-testid="input-amount" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-method">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash" data-testid="select-method-cash">Cash</SelectItem>
                      <SelectItem value="check" data-testid="select-method-check">Check</SelectItem>
                      <SelectItem value="bank_transfer" data-testid="select-method-bank-transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card" data-testid="select-method-credit-card">Credit Card</SelectItem>
                      <SelectItem value="other" data-testid="select-method-other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referenceNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Check number" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-reference-number" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes..." 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-notes" 
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
                disabled={currenciesLoading || saveMutation.isPending}
                data-testid="button-save"
              >
                {saveMutation.isPending ? "Saving..." : payment ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
