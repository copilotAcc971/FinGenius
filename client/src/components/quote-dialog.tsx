import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Quote, type Customer, type Item, type Tax, type Currency, insertQuoteSchema, type QuoteLineItem, type TenantCompanyProfile } from "@shared/schema";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency } from "@/lib/currency-utils";

const quoteFormSchema = insertQuoteSchema.extend({
  quoteDate: z.string(),
  expiryDate: z.string(),
  currencyCode: z.string().length(3, "Currency code must be 3 characters").min(1, "Currency is required"),
});

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
}

export function QuoteDialog({ open, onOpenChange, quote }: QuoteDialogProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: taxes } = useQuery<Tax[]>({
    queryKey: ["/api/taxes", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: companyProfile } = useQuery<TenantCompanyProfile>({
    queryKey: ["/api/company-profile", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
  });

  const { data: existingLineItems } = useQuery<QuoteLineItem[]>({
    queryKey: ["/api/quotes", quote?.id, "line-items", { tenantId: currentTenant?.id }],
    queryFn: async () => {
      if (!quote?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/quotes/${quote.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!quote?.id && !!currentTenant?.id && open,
  });

  // Filter active currencies and find base currency
  const activeCurrencies = currencies.filter(c => c.isActive);
  const baseCurrency = currencies.find(c => c.isBaseCurrency);

  // Get the currency for the current quote (if editing)
  const currentCurrency = quote?.currencyCode 
    ? currencies.find(c => c.code === quote.currencyCode)
    : null;

  // Build available currencies list with useMemo
  const availableCurrencies = useMemo(() => {
    // If editing quote and currencies not loaded yet, create placeholder
    if (quote?.currencyCode && currencies.length === 0) {
      return [{
        code: quote.currencyCode,
        name: quote.currencyCode,
        symbol: quote.currencyCode,
        isActive: false,
        decimalPlaces: 2,
        isBaseCurrency: false,
        tenantId: currentTenant?.id || '',
        id: 'placeholder'
      }];
    }
    
    // Start with all active currencies
    const available = [...activeCurrencies];
    
    // Add ALL inactive currencies (not just quote's currency)
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
  }, [activeCurrencies, currencies, quote?.currencyCode, currentTenant?.id]);

  const form = useForm<z.infer<typeof quoteFormSchema>>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      tenantId: currentTenant?.id || "",
      customerId: "",
      currencyCode: "USD",
      quoteSubject: "",
      issuerTaxId: "",
      customerTaxId: "",
      quoteDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "draft",
      subtotal: "0",
      taxAmount: "0",
      total: "0",
      notes: "",
    },
  });

  // Watch currency code for totals formatting
  const selectedCurrencyCode = useWatch({
    control: form.control,
    name: "currencyCode",
  });

  useEffect(() => {
    if (quote) {
      form.reset({
        tenantId: quote.tenantId,
        customerId: quote.customerId,
        currencyCode: quote.currencyCode,
        quoteSubject: quote.quoteSubject || "",
        issuerTaxId: quote.issuerTaxId || "",
        customerTaxId: quote.customerTaxId || "",
        quoteDate: new Date(quote.quoteDate).toISOString().split('T')[0],
        expiryDate: new Date(quote.expiryDate).toISOString().split('T')[0],
        status: quote.status,
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        total: quote.total,
        notes: quote.notes || "",
      });
    } else {
      form.reset({
        tenantId: currentTenant?.id || "",
        customerId: "",
        currencyCode: baseCurrency?.code || "USD",
        quoteSubject: "",
        issuerTaxId: companyProfile?.taxRegistrationNumber || "",
        customerTaxId: "",
        quoteDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "draft",
        subtotal: "0",
        taxAmount: "0",
        total: "0",
        notes: "",
      });
    }

    if (existingLineItems && existingLineItems.length > 0) {
      setLineItems(existingLineItems.map(item => ({
        itemId: item.itemId || "",
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || "0",
        taxId: item.taxId || "",
        amount: item.amount,
      })));
    } else if (!quote) {
      setLineItems([]);
    }
  }, [quote, existingLineItems, currentTenant, companyProfile, baseCurrency, form]);

  // CRITICAL: Guarded form reset for new quotes only (prevents data corruption when editing)
  useEffect(() => {
    if (!open || quote) return; // NEVER runs when editing
    if (currenciesLoading) return; // Wait for currencies to load
    
    // Only runs for NEW quotes
    const currentValues = form.getValues();
    form.reset({
      ...currentValues,
      tenantId: currentTenant?.id || "",
      currencyCode: baseCurrency?.code || "USD",
      issuerTaxId: companyProfile?.taxRegistrationNumber || "",
    });
  }, [open, quote, currenciesLoading, baseCurrency, currentTenant, companyProfile, form]);

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => {
      const amount = parseFloat(item.amount || "0");
      return sum + amount;
    }, 0);

    const taxAmount = items.reduce((sum, item) => {
      const amount = parseFloat(item.amount || "0");
      const taxRate = taxes?.find(t => t.id === item.taxId)?.rate || "0";
      return sum + (amount * parseFloat(taxRate) / 100);
    }, 0);

    const total = subtotal + taxAmount;

    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      itemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      discount: "0",
      taxId: "",
      amount: "0",
    }]);
  };

  const removeLineItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newItems);
    const totals = calculateTotals(newItems);
    form.setValue("subtotal", totals.subtotal);
    form.setValue("taxAmount", totals.taxAmount);
    form.setValue("total", totals.total);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newItems = [...lineItems];
    newItems[index][field] = value;

    // Calculate amount for this line
    const qty = parseFloat(newItems[index].quantity || "0");
    const price = parseFloat(newItems[index].unitPrice || "0");
    const discount = parseFloat(newItems[index].discount || "0");
    newItems[index].amount = ((qty * price) - discount).toFixed(2);

    setLineItems(newItems);

    const totals = calculateTotals(newItems);
    form.setValue("subtotal", totals.subtotal);
    form.setValue("taxAmount", totals.taxAmount);
    form.setValue("total", totals.total);
  };

  const onSubmit = async (data: z.infer<typeof quoteFormSchema>) => {
    if (!currentTenant?.id) return;

    // Validate line items
    if (!lineItems || lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Recalculate totals before submission to ensure consistency
      const recalculatedTotals = calculateTotals(lineItems);
      
      // Map line items with tenantId and proper validation
      const validatedLineItems = lineItems.map(item => ({
        ...item,
        tenantId: currentTenant.id,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        discount: (item.discount || "0").toString(),
        amount: item.amount.toString(),
      }));

      const payload = {
        ...data,
        quoteDate: new Date(data.quoteDate).toISOString(),
        expiryDate: new Date(data.expiryDate).toISOString(),
        tenantId: currentTenant.id,
        subtotal: recalculatedTotals.subtotal,
        taxAmount: recalculatedTotals.taxAmount,
        total: recalculatedTotals.total,
        lineItems: validatedLineItems,
      };

      if (quote) {
        await apiRequest(`/api/quotes/${quote.id}?tenantId=${currentTenant.id}`, "PATCH", payload);
        toast({ title: "Quote updated successfully" });
      } else {
        await apiRequest(`/api/quotes?tenantId=${currentTenant.id}`, "POST", payload);
        toast({ title: "Quote created successfully" });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/quotes", { tenantId: currentTenant.id }] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: quote ? "Error updating quote" : "Error creating quote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {quote ? "Edit Quote" : "Create Quote"}
          </DialogTitle>
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
                    <SelectContent position="popper">
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id} data-testid={`option-customer-${customer.id}`}>
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
                        <SelectItem key={currency.code} value={currency.code}>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quoteDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-quote-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-expiry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="quoteSubject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-quote-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <FormLabel>Line Items</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-2 border rounded">
                  <div className="col-span-3">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      data-testid={`input-line-description-${index}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      data-testid={`input-line-quantity-${index}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                      data-testid={`input-line-price-${index}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Discount"
                      value={item.discount}
                      onChange={(e) => updateLineItem(index, "discount", e.target.value)}
                      data-testid={`input-line-discount-${index}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={item.amount}
                      disabled
                      placeholder="Amount"
                      data-testid={`input-line-amount-${index}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      data-testid={`button-remove-line-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground" data-testid="text-quote-subtotal">
                  Subtotal: {formatCurrency(
                    parseFloat(form.watch("subtotal") || "0"),
                    selectedCurrencyCode || baseCurrency?.code || 'USD',
                    currenciesLoading ? [] : currencies
                  )}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-quote-tax">
                  Tax: {formatCurrency(
                    parseFloat(form.watch("taxAmount") || "0"),
                    selectedCurrencyCode || baseCurrency?.code || 'USD',
                    currenciesLoading ? [] : currencies
                  )}
                </p>
                <p className="text-lg font-semibold" data-testid="text-quote-total">
                  Total: {formatCurrency(
                    parseFloat(form.watch("total") || "0"),
                    selectedCurrencyCode || baseCurrency?.code || 'USD',
                    currenciesLoading ? [] : currencies
                  )}
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={currenciesLoading || isSubmitting} data-testid="button-submit">
                {isSubmitting ? "Saving..." : quote ? "Update Quote" : "Create Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
