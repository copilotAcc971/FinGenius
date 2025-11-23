import { useForm, useWatch } from "react-hook-form";
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
import { type SalesOrder, type Customer, type Item, type Tax, type Currency, insertSalesOrderSchema, type SalesOrderLineItem } from "@shared/schema";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";

const orderFormSchema = insertSalesOrderSchema.extend({
  orderDate: z.string(),
  shipmentDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  currencyCode: z.string().length(3, "Currency code must be 3 characters").min(1, "Currency is required"),
});

interface SalesOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrder | null;
}

export function SalesOrderDialog({ open, onOpenChange, order }: SalesOrderDialogProps) {
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

  const { data: existingLineItems } = useQuery<SalesOrderLineItem[]>({
    queryKey: ["/api/sales-orders", order?.id, "line-items", { tenantId: currentTenant?.id }],
    queryFn: async () => {
      if (!order?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/sales-orders/${order.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!order?.id && !!currentTenant?.id && open,
  });

  // availableCurrencies with useMemo (seeded pattern)
  const availableCurrencies = useMemo(() => {
    // If editing order and currencies not loaded yet, create placeholder
    if (order?.currencyCode && currencies.length === 0) {
      return [{
        code: order.currencyCode,
        name: order.currencyCode,
        symbol: order.currencyCode,
        isActive: false,
        decimalPlaces: 2,
        isBaseCurrency: false,
        tenantId: currentTenant?.id || '',
        id: 'placeholder'
      }];
    }
    
    // Start with all active currencies
    const available = [...activeCurrencies];
    
    // Add ALL inactive currencies (not just order's currency)
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
  }, [activeCurrencies, currencies, order?.currencyCode, currentTenant?.id]);

  const form = useForm<z.infer<typeof orderFormSchema>>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      tenantId: currentTenant?.id || "",
      customerId: "",
      currencyCode: "USD",
      orderDate: new Date().toISOString().split('T')[0],
      shipmentDate: "",
      deliveryDate: "",
      status: "draft",
      fulfillmentStatus: "unfulfilled",
      subtotal: "0",
      taxAmount: "0",
      total: "0",
      notes: "",
    },
  });

  // Watch currency for totals display
  const selectedCurrencyCode = useWatch({ control: form.control, name: "currencyCode" });
  const safeCurrencyCode = selectedCurrencyCode || baseCurrency?.code || 'USD';

  useEffect(() => {
    if (order) {
      form.reset({
        tenantId: order.tenantId,
        customerId: order.customerId,
        currencyCode: order.currencyCode,
        orderDate: new Date(order.orderDate).toISOString().split('T')[0],
        shipmentDate: order.shipmentDate ? new Date(order.shipmentDate).toISOString().split('T')[0] : "",
        deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : "",
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus || "unfulfilled",
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        total: order.total,
        notes: order.notes || "",
      });
    } else {
      form.reset({
        tenantId: currentTenant?.id || "",
        customerId: "",
        currencyCode: baseCurrency?.code || "USD",
        orderDate: new Date().toISOString().split('T')[0],
        shipmentDate: "",
        deliveryDate: "",
        status: "draft",
        fulfillmentStatus: "unfulfilled",
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
    } else if (!order) {
      setLineItems([]);
    }
  }, [order, existingLineItems, currentTenant, baseCurrency, form]);

  // CRITICAL: Guarded form reset (prevents data corruption)
  // Only runs for NEW orders, NEVER when editing
  useEffect(() => {
    if (!open || order) return; // Only for new orders - prevents corruption
    if (currenciesLoading) return; // Wait for currencies to load
    
    // Reset form with loaded data while preserving any user edits
    const currentValues = form.getValues();
    form.reset({
      ...currentValues,
      currencyCode: baseCurrency?.code || "USD",
    });
  }, [open, order, currenciesLoading, baseCurrency, form]);

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

    // Auto-fill from item if itemId changed
    if (field === "itemId" && value) {
      const selectedItem = items?.find(item => item.id === value);
      if (selectedItem) {
        newItems[index].description = selectedItem.name;
        newItems[index].unitPrice = selectedItem.rate || "0";
        if (selectedItem.taxId) {
          newItems[index].taxId = selectedItem.taxId;
        }
      }
    }

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

  const onSubmit = async (data: z.infer<typeof orderFormSchema>) => {
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
        orderDate: new Date(data.orderDate).toISOString(),
        shipmentDate: data.shipmentDate ? new Date(data.shipmentDate).toISOString() : undefined,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString() : undefined,
        tenantId: currentTenant.id,
        subtotal: recalculatedTotals.subtotal,
        taxAmount: recalculatedTotals.taxAmount,
        total: recalculatedTotals.total,
        lineItems: validatedLineItems,
      };

      if (order) {
        await apiRequest(`/api/sales-orders/${order.id}?tenantId=${currentTenant.id}`, "PATCH", payload);
        toast({ title: "Sales order updated successfully" });
      } else {
        await apiRequest(`/api/sales-orders?tenantId=${currentTenant.id}`, "POST", payload);
        toast({ title: "Sales order created successfully" });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/sales-orders", { tenantId: currentTenant.id }] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: order ? "Error updating sales order" : "Error creating sales order",
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
            {order ? "Edit Sales Order" : "Create Sales Order"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    {currenciesError && (
                      <div className="text-destructive text-sm mt-1">
                        Failed to load currencies. Please refresh the page.
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-order-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-shipment-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-delivery-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <FormLabel>Line Items</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <div key={index} className="space-y-2 p-2 border rounded">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <Select
                        value={item.itemId}
                        onValueChange={(value) => updateLineItem(index, "itemId", value)}
                      >
                        <SelectTrigger data-testid={`select-item-${index}`}>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {items?.map((availableItem) => (
                            <SelectItem key={availableItem.id} value={availableItem.id} data-testid={`option-item-${availableItem.id}`}>
                              {availableItem.name}
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
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        data-testid={`button-remove-line-${index}`}
                        aria-label={`Remove line item ${index + 1}`}
                        title="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                      <Select
                        value={item.taxId}
                        onValueChange={(value) => updateLineItem(index, "taxId", value)}
                      >
                        <SelectTrigger data-testid={`select-tax-${index}`}>
                          <SelectValue placeholder="Select tax (optional)" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="" data-testid="option-no-tax">No Tax</SelectItem>
                          {taxes?.map((tax) => (
                            <SelectItem key={tax.id} value={tax.id} data-testid={`option-tax-${tax.id}`}>
                              {tax.name} ({tax.rate}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="Discount"
                        value={item.discount}
                        onChange={(e) => updateLineItem(index, "discount", e.target.value)}
                        data-testid={`input-line-discount-${index}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        value={item.amount}
                        disabled
                        placeholder="Amount"
                        data-testid={`input-line-amount-${index}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Subtotal: {formatCurrency(
                    parseFloat(form.watch("subtotal") || "0"),
                    safeCurrencyCode,
                    currenciesLoading ? [] : currencies
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  Tax: {formatCurrency(
                    parseFloat(form.watch("taxAmount") || "0"),
                    safeCurrencyCode,
                    currenciesLoading ? [] : currencies
                  )}
                </p>
                <p className="text-lg font-semibold" data-testid="text-order-total">
                  Total: {formatCurrency(
                    parseFloat(form.watch("total") || "0"),
                    safeCurrencyCode,
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
              <Button type="submit" disabled={currenciesLoading || currenciesError || isSubmitting} data-testid="button-submit">
                {isSubmitting ? "Saving..." : order ? "Update Sales Order" : "Create Sales Order"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
