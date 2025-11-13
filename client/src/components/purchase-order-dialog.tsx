import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  purchaseOrderPayloadSchema, 
  type PurchaseOrder, 
  type Vendor, 
  type PurchaseOrderLineItem,
  type Item,
  type Tax,
} from "@shared/schema";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    if (val === '' || val === '0' || val === '0.00') return true;
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed >= 0;
  },
  { message: "Must be a valid number" }
);

const formSchema = z.object({
  purchaseOrder: z.object({
    tenantId: z.string(),
    vendorId: z.string().min(1, "Vendor is required"),
    orderDate: z.string().min(1, "Order date is required"),
    expectedDate: z.string().optional(),
    status: z.string(),
    notes: z.string().optional(),
    terms: z.string().optional(),
    subtotal: z.string(),
    taxAmount: z.string(),
    total: z.string(),
  }),
  lineItems: z.array(z.object({
    itemId: z.string().nullable().optional(),
    description: z.string().min(1, "Description is required"),
    quantity: decimalString,
    unitPrice: decimalString,
    taxId: z.string().nullable().optional(),
    amount: z.string(),
  })).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export function PurchaseOrderDialog({ open, onOpenChange, purchaseOrder }: PurchaseOrderDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: taxes = [] } = useQuery<Tax[]>({
    queryKey: ["/api/taxes", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const { data: lineItems, isLoading: lineItemsLoading } = useQuery<PurchaseOrderLineItem[]>({
    queryKey: [`/api/purchase-orders/${purchaseOrder?.id}/line-items`, { tenantId: currentTenant?.id }],
    enabled: !!purchaseOrder?.id && !!currentTenant?.id && open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      purchaseOrder: {
        tenantId: currentTenant?.id || "",
        vendorId: "",
        orderDate: new Date().toISOString().split('T')[0],
        expectedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "draft",
        notes: "",
        terms: "",
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "0.00",
      },
      lineItems: [{
        itemId: null,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        taxId: null,
        amount: "0.00",
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchedLineItems = useWatch({
    control: form.control,
    name: "lineItems",
  });

  // Initialize form when editing
  useEffect(() => {
    if (!open) return;
    
    if (purchaseOrder && !lineItemsLoading && lineItems) {
      form.reset({
        purchaseOrder: {
          tenantId: purchaseOrder.tenantId,
          vendorId: purchaseOrder.vendorId,
          orderDate: new Date(purchaseOrder.orderDate).toISOString().split('T')[0],
          expectedDate: purchaseOrder.expectedDate ? new Date(purchaseOrder.expectedDate).toISOString().split('T')[0] : "",
          status: purchaseOrder.status,
          notes: purchaseOrder.notes || "",
          terms: purchaseOrder.terms || "",
          subtotal: purchaseOrder.subtotal,
          taxAmount: purchaseOrder.taxAmount,
          total: purchaseOrder.total,
        },
        lineItems: lineItems.length > 0 ? lineItems.map(item => ({
          itemId: item.itemId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxId: item.taxId || null,
          amount: item.amount,
        })) : [{
          itemId: null,
          description: "",
          quantity: "1",
          unitPrice: "0.00",
          taxId: null,
          amount: "0.00",
        }],
      });
    } else if (!purchaseOrder) {
      form.reset({
        purchaseOrder: {
          tenantId: currentTenant?.id || "",
          vendorId: "",
          orderDate: new Date().toISOString().split('T')[0],
          expectedDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: "draft",
          notes: "",
          terms: "",
          subtotal: "0.00",
          taxAmount: "0.00",
          total: "0.00",
        },
        lineItems: [{
          itemId: null,
          description: "",
          quantity: "1",
          unitPrice: "0.00",
          taxId: null,
          amount: "0.00",
        }],
      });
    }
  }, [purchaseOrder, lineItems, lineItemsLoading, open, currentTenant, form]);

  // Calculate totals whenever line items change
  useEffect(() => {
    if (!watchedLineItems) return;

    const subtotal = watchedLineItems.reduce((sum, item) => {
      const amount = safeParseFloat(item?.amount || "0");
      return sum + amount;
    }, 0);

    const taxAmount = watchedLineItems.reduce((sum, item) => {
      const amount = safeParseFloat(item?.amount || "0");
      const tax = taxes.find(t => t.id === item?.taxId);
      const taxRate = tax ? safeParseFloat(tax.rate) : 0;
      return sum + (amount * taxRate / 100);
    }, 0);

    const total = subtotal + taxAmount;

    form.setValue("purchaseOrder.subtotal", subtotal.toFixed(2));
    form.setValue("purchaseOrder.taxAmount", taxAmount.toFixed(2));
    form.setValue("purchaseOrder.total", total.toFixed(2));
  }, [watchedLineItems, taxes, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const payload = {
        purchaseOrder: {
          ...data.purchaseOrder,
          orderDate: new Date(data.purchaseOrder.orderDate),
          expectedDate: data.purchaseOrder.expectedDate ? new Date(data.purchaseOrder.expectedDate) : undefined,
        },
        lineItems: data.lineItems,
      };

      if (purchaseOrder) {
        return await apiRequest(
          `/api/purchase-orders/${purchaseOrder.id}?tenantId=${currentTenant.id}`,
          "PATCH",
          payload
        );
      } else {
        return await apiRequest(
          `/api/purchase-orders?tenantId=${currentTenant.id}`,
          "POST",
          payload
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders", currentTenant?.id] });
      toast({
        title: purchaseOrder ? "Purchase Order updated" : "Purchase Order created",
        description: purchaseOrder 
          ? "Purchase Order has been updated successfully." 
          : "Purchase Order has been created successfully.",
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
        description: error.message || "Failed to save purchase order.",
        variant: "destructive",
      });
    },
  });

  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      form.setValue(`lineItems.${index}.itemId`, itemId);
      form.setValue(`lineItems.${index}.description`, item.description || item.name);
      form.setValue(`lineItems.${index}.unitPrice`, item.purchasePrice || item.rate);
      
      const quantity = safeParseFloat(form.getValues(`lineItems.${index}.quantity`));
      const unitPrice = safeParseFloat(item.purchasePrice || item.rate);
      form.setValue(`lineItems.${index}.amount`, (quantity * unitPrice).toFixed(2));
    }
  };

  const handleLineItemChange = (index: number, field: 'quantity' | 'unitPrice', value: string) => {
    form.setValue(`lineItems.${index}.${field}`, value);
    
    const quantity = safeParseFloat(field === 'quantity' ? value : form.getValues(`lineItems.${index}.quantity`));
    const unitPrice = safeParseFloat(field === 'unitPrice' ? value : form.getValues(`lineItems.${index}.unitPrice`));
    
    form.setValue(`lineItems.${index}.amount`, (quantity * unitPrice).toFixed(2));
  };

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder ? "Edit Purchase Order" : "Create Purchase Order"}
          </DialogTitle>
          <DialogDescription>
            {purchaseOrder 
              ? "Update the purchase order details and line items below." 
              : "Fill in the details below to create a new purchase order. The PO number will be generated automatically."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic" data-testid="tab-basic-details">Basic Details</TabsTrigger>
                <TabsTrigger value="items" data-testid="tab-line-items">Line Items</TabsTrigger>
                <TabsTrigger value="additional" data-testid="tab-additional-info">Additional Info</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseOrder.vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
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
                    name="purchaseOrder.status"
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
                            <SelectItem value="pending_approval">Pending Approval</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="partially_received">Partially Received</SelectItem>
                            <SelectItem value="fully_received">Fully Received</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    name="purchaseOrder.orderDate"
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
                    name="purchaseOrder.expectedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Delivery Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-expected-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="items" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Line Items</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({
                        itemId: null,
                        description: "",
                        quantity: "1",
                        unitPrice: "0.00",
                        taxId: null,
                        amount: "0.00",
                      })}
                      data-testid="button-add-line-item"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium">Item #{index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.itemId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item (Optional)</FormLabel>
                              <Select 
                                onValueChange={(value) => handleItemSelect(index, value)}
                                value={field.value || ""}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-item-${index}`}>
                                    <SelectValue placeholder="Select item or enter custom" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {items.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.taxId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger data-testid={`select-tax-${index}`}>
                                    <SelectValue placeholder="No tax" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">No tax</SelectItem>
                                  {taxes.map((tax) => (
                                    <SelectItem key={tax.id} value={tax.id}>
                                      {tax.name} ({tax.rate}%)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Item description"
                                data-testid={`input-description-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field}
                                  onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                                  data-testid={`input-quantity-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit Price *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field}
                                  onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)}
                                  data-testid={`input-unit-price-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled
                                  className="font-mono"
                                  data-testid={`input-amount-${index}`}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-4">
                    <div className="flex justify-end space-y-2">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-mono" data-testid="text-subtotal">
                            ${safeParseFloat(form.watch("purchaseOrder.subtotal")).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax:</span>
                          <span className="font-mono" data-testid="text-tax">
                            ${safeParseFloat(form.watch("purchaseOrder.taxAmount")).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold text-lg border-t pt-2">
                          <span>Total:</span>
                          <span className="font-mono" data-testid="text-total">
                            ${safeParseFloat(form.watch("purchaseOrder.total")).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                <FormField
                  control={form.control}
                  name="purchaseOrder.terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms & Conditions</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Payment terms, delivery conditions, etc."
                          rows={4}
                          data-testid="input-terms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseOrder.notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Internal notes (not visible to vendor)"
                          rows={4}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                disabled={mutation.isPending}
                data-testid="button-save"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {purchaseOrder ? "Update Purchase Order" : "Create Purchase Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
