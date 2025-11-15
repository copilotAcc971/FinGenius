import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  billPayloadSchema, 
  type Bill, 
  type Vendor, 
  type BillLineItem,
  type Currency
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useTenant } from "@/hooks/useTenant";
import { Plus, Trash2, Loader2, Upload, X, Sparkles, Tag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency-utils";

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
  bill: z.object({
    tenantId: z.string(),
    vendorId: z.string().min(1, "Vendor is required"),
    currencyCode: z.string().length(3, "Currency code must be 3 characters").min(1, "Currency is required"),
    billNumber: z.string().optional(),
    billDate: z.string().min(1, "Bill date is required"),
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
  })).min(1, "At least one line item is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface BillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill | null;
}

export function BillDialog({ open, onOpenChange, bill }: BillDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedCategories, setExtractedCategories] = useState<{
    primaryCategory?: string;
    suggestedCategories?: string[];
    lineItemCategories?: Map<number, string>;
  }>({});

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", currentTenant?.id],
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

  const { data: lineItems, isLoading: lineItemsLoading } = useQuery<BillLineItem[]>({
    queryKey: ["/api/bills", bill?.id, "line-items", currentTenant?.id],
    queryFn: async () => {
      if (!bill?.id || !currentTenant?.id) return [];
      const response = await fetch(`/api/bills/${bill.id}/line-items?tenantId=${currentTenant.id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch line items");
      return response.json();
    },
    enabled: !!bill?.id && !!currentTenant?.id && open,
  });

  // Build available currencies list with useMemo
  const availableCurrencies = useMemo(() => {
    // If editing bill and currencies not loaded yet, create placeholder
    if (bill?.currencyCode && currencies.length === 0) {
      return [{
        code: bill.currencyCode,
        name: bill.currencyCode,
        symbol: bill.currencyCode,
        isActive: false,
        decimalPlaces: 2,
        isBaseCurrency: false,
        tenantId: currentTenant?.id || '',
        id: 'placeholder'
      }];
    }
    
    // Start with all active currencies
    const available = [...activeCurrencies];
    
    // Add ALL inactive currencies (not just bill's currency)
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
  }, [activeCurrencies, currencies, bill?.currencyCode, currentTenant?.id]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bill: {
        tenantId: currentTenant?.id || "",
        vendorId: "",
        currencyCode: "USD",
        billNumber: "",
        billDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "unpaid",
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

  const selectedCurrencyCode = useWatch({
    control: form.control,
    name: "bill.currencyCode",
  });

  // Calculate amounts and totals using useMemo
  const calculatedValues = useMemo(() => {
    const lineItems = watchedLineItems || [];
    
    // Calculate individual line item amounts
    const itemsWithCalculatedAmounts = lineItems.map((item) => {
      if (!item) return { amount: "0.00" };
      
      const qty = safeParseFloat(item.quantity);
      const price = safeParseFloat(item.unitPrice);
      const amount = qty * price;
      
      return { amount: amount.toFixed(2) };
    });

    // Calculate totals
    const subtotal = itemsWithCalculatedAmounts.reduce((sum, item) => {
      return sum + safeParseFloat(item.amount);
    }, 0);
    
    const taxAmount = safeParseFloat(form.getValues('bill.taxAmount'));
    const total = subtotal + taxAmount;

    return {
      itemsWithCalculatedAmounts,
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
    };
  }, [watchedLineItems, form]);

  // Update form values when calculated values change
  useEffect(() => {
    calculatedValues.itemsWithCalculatedAmounts.forEach((item, index) => {
      const currentAmount = form.getValues(`lineItems.${index}.amount`);
      if (currentAmount !== item.amount) {
        form.setValue(`lineItems.${index}.amount`, item.amount, { shouldValidate: false });
      }
    });

    const currentSubtotal = form.getValues('bill.subtotal');
    const currentTotal = form.getValues('bill.total');
    
    if (currentSubtotal !== calculatedValues.subtotal) {
      form.setValue('bill.subtotal', calculatedValues.subtotal, { shouldValidate: false });
    }
    
    if (currentTotal !== calculatedValues.total) {
      form.setValue('bill.total', calculatedValues.total, { shouldValidate: false });
    }
  }, [calculatedValues, form]);

  // Reinitialize form when tenant/currency data loads (for new bills)
  // This ensures tenantId and currencyCode are populated even if form initialized before data loaded
  // CRITICAL: Only runs for NEW bills, NEVER when editing (prevents data corruption)
  useEffect(() => {
    if (!open || bill) return; // Only for new bills - prevents corruption of existing bill data
    if (!currentTenant) return; // Wait for tenant to load
    if (currenciesLoading) return; // Wait for currencies to finish loading
    
    // Reset form with loaded data while preserving any user edits
    const currentValues = form.getValues();
    form.reset({
      bill: {
        ...currentValues.bill,
        tenantId: currentTenant.id,
        currencyCode: baseCurrency?.code || "USD",
      },
      lineItems: currentValues.lineItems,
    });
  }, [open, bill, currentTenant, currenciesLoading, baseCurrency, form]);

  // Reset form when editing and line items have loaded
  useEffect(() => {
    if (!open || !bill || lineItemsLoading || !lineItems) return;
    
    form.reset({
      bill: {
        tenantId: bill.tenantId,
        vendorId: bill.vendorId,
        currencyCode: bill.currencyCode,
        billNumber: bill.billNumber || "",
        billDate: new Date(bill.billDate).toISOString().split('T')[0],
        dueDate: new Date(bill.dueDate).toISOString().split('T')[0],
        status: bill.status,
        subtotal: bill.subtotal,
        taxAmount: bill.taxAmount,
        total: bill.total,
        notes: bill.notes || "",
      },
      lineItems: lineItems.length > 0 ? lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })) : [{
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        amount: "0.00",
      }],
    });
  }, [bill, lineItems, lineItemsLoading, form, open]);

  // Reset form immediately when creating new bill
  useEffect(() => {
    if (!open || bill) return;
    
    form.reset({
      bill: {
        tenantId: currentTenant?.id || "",
        vendorId: "",
        currencyCode: baseCurrency?.code || "USD",
        billNumber: "",
        billDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "unpaid",
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
      }],
    });
    setUploadedImage(null);
  }, [bill, currentTenant, baseCurrency, form, open]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractWithAI = async () => {
    if (!uploadedImage) return;

    setIsExtracting(true);
    try {
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64Data = uploadedImage.split(',')[1];
      
      const response = await apiRequest('/api/bills/extract', 'POST', { 
        image: base64Data 
      });
      
      const extractedData = await response.json();

      // Find vendor by name
      const vendor = vendors.find(v => 
        v.name.toLowerCase().includes(extractedData.vendorName.toLowerCase()) ||
        extractedData.vendorName.toLowerCase().includes(v.name.toLowerCase())
      );

      // Store extracted categories for display
      const lineItemCategories = new Map<number, string>();
      extractedData.lineItems.forEach((item: any, index: number) => {
        if (item.suggestedCategory) {
          lineItemCategories.set(index, item.suggestedCategory);
        }
      });

      setExtractedCategories({
        primaryCategory: extractedData.primaryCategory,
        suggestedCategories: extractedData.suggestedCategories,
        lineItemCategories,
      });

      // Auto-fill form with extracted data
      form.setValue('bill.vendorId', vendor?.id || '', { shouldValidate: false });
      form.setValue('bill.billNumber', extractedData.billNumber || '', { shouldValidate: false });
      form.setValue('bill.billDate', extractedData.billDate || new Date().toISOString().split('T')[0], { shouldValidate: false });
      form.setValue('bill.dueDate', extractedData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], { shouldValidate: false });
      form.setValue('bill.taxAmount', extractedData.taxAmount.toFixed(2), { shouldValidate: false });
      form.setValue('bill.notes', extractedData.notes || '', { shouldValidate: false });

      // Replace line items with extracted data
      form.setValue('lineItems', extractedData.lineItems.map((item: {
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        suggestedCategory?: string;
        suggestedAccountType?: string;
      }) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toFixed(2),
        amount: item.amount.toFixed(2),
      })), { shouldValidate: false });

      toast({
        title: "✨ Data extracted successfully",
        description: `Classified as "${extractedData.primaryCategory}". ${extractedData.lineItems.length} line items extracted with AI categorization.`,
      });
    } catch (error: any) {
      toast({
        title: "Extraction failed",
        description: error.message || "Failed to extract bill data. Please enter manually.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        bill: {
          tenantId: values.bill.tenantId,
          vendorId: values.bill.vendorId,
          currencyCode: values.bill.currencyCode,
          billNumber: values.bill.billNumber || undefined,
          billDate: new Date(values.bill.billDate).toISOString(),
          dueDate: new Date(values.bill.dueDate).toISOString(),
          status: values.bill.status,
          subtotal: values.bill.subtotal,
          taxAmount: values.bill.taxAmount,
          total: values.bill.total,
          notes: values.bill.notes || undefined,
        },
        lineItems: values.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
      };

      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const res = bill 
        ? await apiRequest(`/api/bills/${bill.id}?tenantId=${currentTenant.id}`, "PATCH", payload)
        : await apiRequest(`/api/bills?tenantId=${currentTenant.id}`, "POST", payload);
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({
        title: bill ? "Bill updated" : "Bill created",
        description: `Bill has been ${bill ? "updated" : "created"} successfully.`,
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
        title: `Failed to ${bill ? "update" : "create"} bill`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-bill-dialog-title">
            {bill ? "Edit Bill" : "Create New Bill"}
          </DialogTitle>
          <DialogDescription>
            {bill ? "Update the bill details below." : "Upload a bill document or enter details manually."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {!bill && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    id="bill-upload"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-bill-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('bill-upload')?.click()}
                    data-testid="button-upload-bill"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Bill Document
                  </Button>
                  
                  {uploadedImage && (
                    <Button
                      type="button"
                      onClick={handleExtractWithAI}
                      disabled={isExtracting}
                      data-testid="button-extract-ai"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Extract with AI
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {uploadedImage && (
                  <div className="relative">
                    <img
                      src={uploadedImage}
                      alt="Uploaded bill"
                      className="max-h-64 rounded-md border"
                      data-testid="img-bill-preview"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setUploadedImage(null)}
                      data-testid="button-remove-image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {extractedCategories.primaryCategory && (
              <Alert className="bg-primary/5 border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertDescription className="flex items-center gap-2">
                  <span className="font-medium">AI Classification:</span>
                  <Badge variant="default" data-testid="badge-primary-category">
                    {extractedCategories.primaryCategory}
                  </Badge>
                  {extractedCategories.suggestedCategories && extractedCategories.suggestedCategories.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      +{extractedCategories.suggestedCategories.length - 1} more
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="bill.vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor *</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-bill-vendor">
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
                name="bill.currencyCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-currency" disabled={currenciesLoading}>
                          <SelectValue placeholder={currenciesLoading ? "Loading currencies..." : "Select currency"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCurrencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
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

              <FormField
                control={form.control}
                name="bill.billNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Auto-generated if blank"
                        data-testid="input-bill-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bill.billDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Date *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date" 
                        data-testid="input-bill-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bill.dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="date" 
                        data-testid="input-bill-due-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bill.status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-bill-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
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
                  })}
                  data-testid="button-add-line-item"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => {
                const suggestedCategory = extractedCategories.lineItemCategories?.get(index);
                
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start border-b pb-4">
                    <div className="col-span-5">
                      <FormField
                        control={form.control}
                        name={`lineItems.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Description"
                                data-testid={`input-line-item-description-${index}`}
                              />
                            </FormControl>
                            {suggestedCategory && (
                              <div className="flex items-center gap-1 mt-1">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                  data-testid={`badge-category-${index}`}
                                >
                                  {suggestedCategory}
                                </Badge>
                              </div>
                            )}
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
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Qty"
                              data-testid={`input-line-item-quantity-${index}`}
                            />
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
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Price"
                              data-testid={`input-line-item-unit-price-${index}`}
                            />
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
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled 
                              placeholder="Amount"
                              data-testid={`input-line-item-amount-${index}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        data-testid={`button-remove-line-item-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div></div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span data-testid="text-bill-subtotal">
                    {formatCurrency(parseFloat(calculatedValues.subtotal), selectedCurrencyCode || baseCurrency?.code || 'USD', currenciesLoading ? [] : currencies)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tax:</span>
                  <FormField
                    control={form.control}
                    name="bill.taxAmount"
                    render={({ field }) => (
                      <FormItem className="flex-1 max-w-[120px]">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="0.00"
                            className="text-right"
                            data-testid="input-bill-tax-amount"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span data-testid="text-bill-total">
                    {formatCurrency(parseFloat(calculatedValues.total), selectedCurrencyCode || baseCurrency?.code || 'USD', currenciesLoading ? [] : currencies)}
                  </span>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="bill.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Additional notes..."
                      data-testid="input-bill-notes"
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
                data-testid="button-cancel-bill"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveMutation.isPending || currenciesLoading || currenciesError}
                data-testid="button-save-bill"
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {bill ? "Update Bill" : "Create Bill"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
