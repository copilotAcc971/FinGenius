import { useForm } from "react-hook-form";
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
import { type RetainerInvoice, type Customer, type Item, type Tax, insertRetainerInvoiceSchema, type RetainerInvoiceLineItem, type TenantCompanyProfile } from "@shared/schema";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const retainerInvoiceFormSchema = insertRetainerInvoiceSchema.extend({
  invoiceDate: z.string(),
});

interface RetainerInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retainerInvoice: RetainerInvoice | null;
}

export function RetainerInvoiceDialog({ open, onOpenChange, retainerInvoice }: RetainerInvoiceDialogProps) {
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

  const { data: existingLineItems } = useQuery<RetainerInvoiceLineItem[]>({
    queryKey: ["/api/retainer-invoices", retainerInvoice?.id, "line-items", { tenantId: currentTenant?.id }],
    queryFn: async () => {
      if (!retainerInvoice?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/retainer-invoices/${retainerInvoice.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!retainerInvoice?.id && !!currentTenant?.id && open,
  });

  const form = useForm<z.infer<typeof retainerInvoiceFormSchema>>({
    resolver: zodResolver(retainerInvoiceFormSchema),
    defaultValues: {
      tenantId: currentTenant?.id || "",
      customerId: "",
      invoiceDate: new Date().toISOString().split('T')[0],
      invoiceSubject: "",
      issuerTaxId: "",
      customerTaxId: "",
      status: "draft",
      subtotal: "0",
      taxAmount: "0",
      total: "0",
      notes: "",
      terms: "",
    },
  });

  useEffect(() => {
    if (retainerInvoice) {
      form.reset({
        tenantId: retainerInvoice.tenantId,
        customerId: retainerInvoice.customerId,
        invoiceDate: new Date(retainerInvoice.invoiceDate).toISOString().split('T')[0],
        invoiceSubject: retainerInvoice.invoiceSubject || "",
        issuerTaxId: retainerInvoice.issuerTaxId || "",
        customerTaxId: retainerInvoice.customerTaxId || "",
        status: retainerInvoice.status,
        subtotal: retainerInvoice.subtotal,
        taxAmount: retainerInvoice.taxAmount,
        total: retainerInvoice.total,
        notes: retainerInvoice.notes || "",
        terms: retainerInvoice.terms || "",
      });
    } else {
      form.reset({
        tenantId: currentTenant?.id || "",
        customerId: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        invoiceSubject: "",
        issuerTaxId: companyProfile?.taxRegistrationNumber || "",
        customerTaxId: "",
        status: "draft",
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
  }, [retainerInvoice, existingLineItems, currentTenant, companyProfile, form]);

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

  const onSubmit = async (data: z.infer<typeof retainerInvoiceFormSchema>) => {
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
        invoiceDate: new Date(data.invoiceDate).toISOString(),
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

      if (retainerInvoice) {
        await apiRequest(
          `/api/retainer-invoices/${retainerInvoice.id}?tenantId=${currentTenant.id}`,
          "PATCH",
          payload
        );
        toast({ title: "Retainer invoice updated successfully" });
      } else {
        await apiRequest(
          `/api/retainer-invoices?tenantId=${currentTenant.id}`,
          "POST",
          payload
        );
        toast({ title: "Retainer invoice created successfully" });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/retainer-invoices", { tenantId: currentTenant.id }] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: retainerInvoice ? "Error updating retainer invoice" : "Error creating retainer invoice",
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
            {retainerInvoice ? "Edit Retainer Invoice" : "New Retainer Invoice"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="invoiceDate"
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
            </div>

            <FormField
              control={form.control}
              name="invoiceSubject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Invoice subject" data-testid="input-invoice-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issuerTaxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuer Tax ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Tax ID" data-testid="input-issuer-tax-id" />
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
                      <Input {...field} placeholder="Tax ID" data-testid="input-customer-tax-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Line Items</h3>
                <Button type="button" onClick={addLineItem} size="sm" data-testid="button-add-line-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((lineItem, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start border-b pb-4 last:border-b-0" data-testid={`line-item-${index}`}>
                  <div className="col-span-12 md:col-span-2">
                    <FormLabel>Item</FormLabel>
                    <Select
                      value={lineItem.itemId}
                      onValueChange={(value) => updateLineItem(index, 'itemId', value)}
                    >
                      <SelectTrigger data-testid={`select-item-${index}`}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {items?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <FormLabel>Description</FormLabel>
                    <Input
                      value={lineItem.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      data-testid={`input-description-${index}`}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-1">
                    <FormLabel>Qty</FormLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={lineItem.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      data-testid={`input-quantity-${index}`}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-2">
                    <FormLabel>Unit Price</FormLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={lineItem.unitPrice}
                      onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                      data-testid={`input-unit-price-${index}`}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-2">
                    <FormLabel>Discount</FormLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={lineItem.discount}
                      onChange={(e) => updateLineItem(index, 'discount', e.target.value)}
                      data-testid={`input-discount-${index}`}
                    />
                  </div>

                  <div className="col-span-5 md:col-span-1">
                    <FormLabel>Tax</FormLabel>
                    <Select
                      value={lineItem.taxId}
                      onValueChange={(value) => updateLineItem(index, 'taxId', value)}
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

                  <div className="col-span-1 md:col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span data-testid="text-subtotal">${totals.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax Amount:</span>
                <span data-testid="text-tax-amount">${totals.taxAmount}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span data-testid="text-total">${totals.total}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Internal notes" rows={3} data-testid="input-notes" />
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
                    <FormLabel>Terms</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Payment terms" rows={3} data-testid="input-terms" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
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
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
                {isSubmitting ? "Saving..." : retainerInvoice ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
