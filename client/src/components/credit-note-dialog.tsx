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
import { type CreditNote, type Customer, type Invoice, type Item, type Tax, insertCreditNoteSchema, type CreditNoteLineItem } from "@shared/schema";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const creditNoteFormSchema = insertCreditNoteSchema.extend({
  creditNoteDate: z.string(),
});

interface CreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote: CreditNote | null;
}

export function CreditNoteDialog({ open, onOpenChange, creditNote }: CreditNoteDialogProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { tenantId: currentTenant?.id }],
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

  const { data: existingLineItems } = useQuery<CreditNoteLineItem[]>({
    queryKey: ["/api/credit-notes", creditNote?.id, "line-items", { tenantId: currentTenant?.id }],
    queryFn: async () => {
      if (!creditNote?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/credit-notes/${creditNote.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!creditNote?.id && !!currentTenant?.id && open,
  });

  const form = useForm<z.infer<typeof creditNoteFormSchema>>({
    resolver: zodResolver(creditNoteFormSchema),
    defaultValues: {
      tenantId: currentTenant?.id || "",
      customerId: "",
      invoiceId: "",
      creditNoteDate: new Date().toISOString().split('T')[0],
      status: "draft",
      subtotal: "0",
      taxAmount: "0",
      total: "0",
      balanceRemaining: "0",
      reason: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (creditNote) {
      form.reset({
        tenantId: creditNote.tenantId,
        customerId: creditNote.customerId,
        invoiceId: creditNote.invoiceId || "",
        creditNoteDate: new Date(creditNote.creditNoteDate).toISOString().split('T')[0],
        status: creditNote.status,
        subtotal: creditNote.subtotal,
        taxAmount: creditNote.taxAmount,
        total: creditNote.total,
        balanceRemaining: creditNote.balanceRemaining,
        reason: creditNote.reason || "",
        notes: creditNote.notes || "",
      });
    } else {
      form.reset({
        tenantId: currentTenant?.id || "",
        customerId: "",
        invoiceId: "",
        creditNoteDate: new Date().toISOString().split('T')[0],
        status: "draft",
        subtotal: "0",
        taxAmount: "0",
        total: "0",
        balanceRemaining: "0",
        reason: "",
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
    } else if (!creditNote) {
      setLineItems([]);
    }
  }, [creditNote, existingLineItems, currentTenant, form]);

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
    form.setValue("balanceRemaining", totals.total);
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
    // Only set balanceRemaining to total if this is a new credit note
    if (!creditNote) {
      form.setValue("balanceRemaining", totals.total);
    }
  };

  const onSubmit = async (data: z.infer<typeof creditNoteFormSchema>) => {
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
        creditNoteDate: new Date(data.creditNoteDate).toISOString(),
        tenantId: currentTenant.id,
        subtotal: recalculatedTotals.subtotal,
        taxAmount: recalculatedTotals.taxAmount,
        total: recalculatedTotals.total,
        balanceRemaining: creditNote ? data.balanceRemaining : recalculatedTotals.total,
        lineItems: validatedLineItems,
      };

      if (creditNote) {
        await apiRequest(`/api/credit-notes/${creditNote.id}?tenantId=${currentTenant.id}`, "PATCH", payload);
        toast({ title: "Credit note updated successfully" });
      } else {
        await apiRequest(`/api/credit-notes?tenantId=${currentTenant.id}`, "POST", payload);
        toast({ title: "Credit note created successfully" });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/credit-notes", { tenantId: currentTenant.id }] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: creditNote ? "Error updating credit note" : "Error creating credit note",
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
            {creditNote ? "Edit Credit Note" : "Create Credit Note"}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Invoice (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-invoice">
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper">
                        <SelectItem value="">None</SelectItem>
                        {invoices?.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id} data-testid={`option-invoice-${invoice.id}`}>
                            {invoice.invoiceNumber} - ${parseFloat(invoice.total).toFixed(2)}
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
                name="creditNoteDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Note Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-credit-note-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="e.g., Product return, pricing error" data-testid="input-reason" />
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

            <div className="flex justify-end space-x-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal: ${form.watch("subtotal")}</p>
                <p className="text-sm text-muted-foreground">Tax: ${form.watch("taxAmount")}</p>
                <p className="text-lg font-semibold" data-testid="text-credit-note-total">Total: ${form.watch("total")}</p>
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
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit">
                {isSubmitting ? "Saving..." : creditNote ? "Update Credit Note" : "Create Credit Note"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
