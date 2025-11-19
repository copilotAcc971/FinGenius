import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
import { type RecurringInvoice, type Customer, type Item, type Tax, insertRecurringInvoiceSchema, type RecurringInvoiceLineItem, type TenantCompanyProfile, type Currency } from "@shared/schema";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";

const recurringInvoiceFormSchema = insertRecurringInvoiceSchema.extend({
  startDate: z.string(),
  endDate: z.string().optional(),
});

interface RecurringInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurringInvoice: RecurringInvoice | null;
}

export function RecurringInvoiceDialog({ open, onOpenChange, recurringInvoice }: RecurringInvoiceDialogProps) {
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

  const { 
    data: currencies = [], 
    isLoading: currenciesLoading,
    isError: currenciesError 
  } = useQuery<Currency[]>({
    queryKey: ['/api/currencies', { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const activeCurrencies = currencies.filter(c => c.isActive);
  const baseCurrency = currencies.find(c => c.isBaseCurrency);

  const availableCurrencies = useMemo(() => {
    if (!open || recurringInvoice) return currencies;
    if (currenciesLoading) return [{ code: 'USD', name: 'US Dollar', symbol: '$', isActive: true, decimalPlaces: 2 }];
    return currencies;
  }, [currencies, currenciesLoading, open, recurringInvoice]);

  const { data: existingLineItems } = useQuery<RecurringInvoiceLineItem[]>({
    queryKey: ["/api/recurring-invoices", recurringInvoice?.id, "line-items", { tenantId: currentTenant?.id }],
    queryFn: async () => {
      if (!recurringInvoice?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/recurring-invoices/${recurringInvoice.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!recurringInvoice?.id && !!currentTenant?.id && open,
  });

  const form = useForm<z.infer<typeof recurringInvoiceFormSchema>>({
    resolver: zodResolver(recurringInvoiceFormSchema),
    defaultValues: {
      tenantId: currentTenant?.id || "",
      customerId: "",
      currency: "",
      frequency: "monthly",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      invoiceSubject: "",
      issuerTaxId: "",
      customerTaxId: "",
      status: "active",
      subtotal: "0",
      taxAmount: "0",
      total: "0",
      notes: "",
      terms: "",
    },
  });

  useEffect(() => {
    if (!open || (!recurringInvoice && currenciesLoading)) return;

    if (recurringInvoice) {
      form.reset({
        tenantId: recurringInvoice.tenantId,
        customerId: recurringInvoice.customerId,
        currency: recurringInvoice.currency || baseCurrency?.code || "USD",
        frequency: recurringInvoice.frequency,
        startDate: new Date(recurringInvoice.startDate).toISOString().split('T')[0],
        endDate: recurringInvoice.endDate ? new Date(recurringInvoice.endDate).toISOString().split('T')[0] : "",
        invoiceSubject: recurringInvoice.invoiceSubject || "",
        issuerTaxId: recurringInvoice.issuerTaxId || "",
        customerTaxId: recurringInvoice.customerTaxId || "",
        status: recurringInvoice.status,
        subtotal: recurringInvoice.subtotal,
        taxAmount: recurringInvoice.taxAmount,
        total: recurringInvoice.total,
        notes: recurringInvoice.notes || "",
        terms: recurringInvoice.terms || "",
      });
    } else {
      form.reset({
        tenantId: currentTenant?.id || "",
        customerId: "",
        currency: baseCurrency?.code || "USD",
        frequency: "monthly",
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        invoiceSubject: "",
        issuerTaxId: companyProfile?.taxRegistrationNumber || "",
        customerTaxId: "",
        status: "active",
        subtotal: "0",
        taxAmount: "0",
        total: "0",
        notes: "",
        terms: "",
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
      })));
    } else {
      setLineItems([{
        itemId: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
        discount: "0",
        taxId: "",
      }]);
    }
  }, [recurringInvoice, existingLineItems, currentTenant, companyProfile, baseCurrency, currenciesLoading, open, form]);

  const addLineItem = () => {
    setLineItems([...lineItems, {
      itemId: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      discount: "0",
      taxId: "",
    }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'itemId' && value) {
      const selectedItem = items?.find(item => item.id === value);
      if (selectedItem) {
        updated[index].description = selectedItem.description || selectedItem.name;
        updated[index].unitPrice = selectedItem.rate;
      }
    }

    setLineItems(updated);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    lineItems.forEach(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      const lineTotal = (quantity * unitPrice) - discount;
      subtotal += lineTotal;

      if (item.taxId) {
        const tax = taxes?.find(t => t.id === item.taxId);
        if (tax) {
          taxAmount += lineTotal * (parseFloat(tax.rate) / 100);
        }
      }
    });

    const total = subtotal + taxAmount;

    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const onSubmit = async (data: z.infer<typeof recurringInvoiceFormSchema>) => {
    if (!currentTenant?.id) return;

    if (lineItems.length === 0 || !lineItems.some(item => item.description)) {
      toast({
        title: "Validation error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const totals = calculateTotals();
      const payload = {
        ...data,
        tenantId: currentTenant.id,
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        lineItems: lineItems.map(item => ({
          itemId: item.itemId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || "0",
          taxId: item.taxId || null,
          amount: ((parseFloat(item.quantity) * parseFloat(item.unitPrice)) - parseFloat(item.discount || "0")).toFixed(2),
        })),
      };

      if (recurringInvoice) {
        await apiRequest(
          `/api/recurring-invoices/${recurringInvoice.id}?tenantId=${currentTenant.id}`,
          "PATCH",
          payload
        );
        toast({ title: "Recurring invoice updated successfully" });
      } else {
        await apiRequest(
          `/api/recurring-invoices?tenantId=${currentTenant.id}`,
          "POST",
          payload
        );
        toast({ title: "Recurring invoice created successfully" });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices", { tenantId: currentTenant.id }] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: recurringInvoice ? "Error updating recurring invoice" : "Error creating recurring invoice",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {recurringInvoice ? "Edit Recurring Invoice" : "New Recurring Invoice"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
                        {customers?.map((customer) => (
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
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={currenciesLoading}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCurrencies
                          .sort((a, b) => {
                            if (a.isActive && !b.isActive) return -1;
                            if (!a.isActive && b.isActive) return 1;
                            return a.code.localeCompare(b.code);
                          })
                          .map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.code} - {curr.name}
                              {!curr.isActive && ' (Inactive)'}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {currenciesError && (
                      <div className="text-destructive text-sm mt-1">
                        Failed to load currencies. Please refresh the page.
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="invoiceSubject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Subject</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., Monthly Service Fee" data-testid="input-invoice-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issuerTaxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuer Tax ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Your tax ID" data-testid="input-issuer-tax-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerTaxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Tax ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="Customer tax ID" data-testid="input-customer-tax-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Line Items</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start" data-testid={`line-item-${index}`}>
                  <div className="col-span-3">
                    <Select
                      value={item.itemId}
                      onValueChange={(value) => updateLineItem(index, "itemId", value)}
                    >
                      <SelectTrigger data-testid={`select-item-${index}`}>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-3">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      data-testid={`input-description-${index}`}
                    />
                  </div>

                  <div className="col-span-1">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      data-testid={`input-quantity-${index}`}
                    />
                  </div>

                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                      data-testid={`input-unit-price-${index}`}
                    />
                  </div>

                  <div className="col-span-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Disc"
                      value={item.discount}
                      onChange={(e) => updateLineItem(index, "discount", e.target.value)}
                      data-testid={`input-discount-${index}`}
                    />
                  </div>

                  <div className="col-span-1">
                    <Select
                      value={item.taxId}
                      onValueChange={(value) => updateLineItem(index, "taxId", value)}
                    >
                      <SelectTrigger data-testid={`select-tax-${index}`}>
                        <SelectValue placeholder="Tax" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {taxes?.map((tax) => (
                          <SelectItem key={tax.id} value={tax.id}>
                            {tax.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                      data-testid={`button-remove-line-item-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold" data-testid="text-subtotal">{formatCurrency(parseFloat(totals.subtotal), form.watch("currency") || baseCurrency?.code || "USD", currencies)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tax:</span>
                  <span className="font-semibold" data-testid="text-tax-amount">{formatCurrency(parseFloat(totals.taxAmount), form.watch("currency") || baseCurrency?.code || "USD", currencies)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="font-semibold">Total:</span>
                  <span className="font-semibold text-lg" data-testid="text-total">{formatCurrency(parseFloat(totals.total), form.watch("currency") || baseCurrency?.code || "USD", currencies)}</span>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={3} placeholder="Additional notes..." data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} rows={3} placeholder="Payment terms and conditions..." data-testid="input-terms" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={currenciesLoading || currenciesError || isSubmitting} data-testid="button-submit">
                {isSubmitting ? "Saving..." : recurringInvoice ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
