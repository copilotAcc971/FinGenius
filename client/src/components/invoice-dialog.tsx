import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  invoicePayloadSchema, 
  type Invoice, 
  type Customer, 
  type InvoiceLineItem,
  type Item,
  type Tax,
  type TenantCompanyProfile,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useTenant } from "@/hooks/useTenant";
import { Plus, Trash2, Loader2, AlertCircle, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";
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
  invoice: z.object({
    tenantId: z.string(),
    customerId: z.string().min(1, "Customer is required"),
    currencyCode: z.string().length(3, "Currency code must be 3 characters").min(1, "Currency is required"),
    invoiceNumber: z.string().optional(),
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    status: z.string(),
    invoiceSubject: z.string().optional(),
    poReference: z.string().optional(),
    issuerTaxId: z.string().min(1, "Company tax registration number required"),
    customerTaxId: z.string().optional(),
    subtotal: z.string(),
    taxAmount: z.string(),
    total: z.string(),
    notes: z.string().optional(),
  }),
  lineItems: z.array(z.object({
    itemId: z.string().nullable().optional(),
    description: z.string().min(1, "Description is required"),
    quantity: decimalString,
    unitPrice: decimalString,
    discount: decimalString.optional(),
    taxId: z.string().nullable().optional(),
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
    enabled: !!currentTenant?.id && open,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
  });

  const { data: taxes = [] } = useQuery<Tax[]>({
    queryKey: ["/api/taxes", currentTenant?.id],
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

  const { data: companyProfile, isLoading: profileLoading } = useQuery<TenantCompanyProfile>({
    queryKey: ["/api/company-profile", currentTenant?.id],
    enabled: !!currentTenant?.id && open,
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
    enabled: !!invoice?.id && !!currentTenant?.id && open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoice: {
        tenantId: currentTenant?.id || "",
        customerId: "",
        currencyCode: "USD",
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "draft",
        invoiceSubject: "",
        poReference: "",
        issuerTaxId: "",
        customerTaxId: "",
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "0.00",
        notes: "",
      },
      lineItems: [{
        itemId: null,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        discount: "0.00",
        taxId: null,
        amount: "0.00",
        accountId: null,
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

  const watchedCustomerId = useWatch({
    control: form.control,
    name: "invoice.customerId",
  });

  const selectedCurrencyCode = useWatch({
    control: form.control,
    name: "invoice.currencyCode",
  });

  // Build available currencies list with useMemo
  const availableCurrencies = useMemo(() => {
    // If editing invoice and currencies not loaded yet, create placeholder
    if (invoice?.currencyCode && currencies.length === 0) {
      return [{
        code: invoice.currencyCode,
        name: invoice.currencyCode,
        symbol: invoice.currencyCode,
        isActive: false,
        decimalPlaces: 2,
        isBaseCurrency: false,
        tenantId: currentTenant?.id || '',
        id: 'placeholder'
      }];
    }
    
    // Start with all active currencies
    const available = [...activeCurrencies];
    
    // Add ALL inactive currencies (not just invoice's currency)
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
  }, [activeCurrencies, currencies, invoice?.currencyCode, currentTenant?.id]);

  // Reinitialize form when tenant/profile data loads (for new invoices)
  // This ensures tenantId, issuerTaxId, and currencyCode are populated even if form initialized before data loaded
  // CRITICAL: Only runs for NEW invoices, NEVER when editing (prevents data corruption)
  useEffect(() => {
    if (!open || invoice) return; // Only for new invoices - prevents corruption of existing invoice data
    if (!currentTenant) return; // Wait for tenant to load
    if (profileLoading) return; // Wait for profile to finish loading
    
    // Reset form with loaded data while preserving any user edits
    const currentValues = form.getValues();
    form.reset({
      invoice: {
        ...currentValues.invoice,
        tenantId: currentTenant.id,
        currencyCode: baseCurrency?.code || "USD",
        issuerTaxId: companyProfile?.taxRegistrationNumber || "",
      },
      lineItems: currentValues.lineItems,
    });
  }, [open, invoice, currentTenant, companyProfile, profileLoading, baseCurrency, form]);

  // Auto-populate customer tax ID when customer is selected
  useEffect(() => {
    if (watchedCustomerId) {
      const customer = customers.find(c => c.id === watchedCustomerId);
      if (customer?.taxRegistrationNumber) {
        form.setValue("invoice.customerTaxId", customer.taxRegistrationNumber, { shouldValidate: false });
      } else {
        form.setValue("invoice.customerTaxId", "", { shouldValidate: false });
      }
    }
  }, [watchedCustomerId, customers, form]);

  // Handle item selection - auto-populate description, unit price, and tax
  const handleItemSelect = (itemId: string | null, index: number) => {
    if (itemId) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        form.setValue(`lineItems.${index}.description`, item.description || item.name, { shouldValidate: false });
        form.setValue(`lineItems.${index}.unitPrice`, item.rate, { shouldValidate: false });
        if (item.taxId) {
          form.setValue(`lineItems.${index}.taxId`, item.taxId, { shouldValidate: false });
        }
      }
    }
  };

  // Calculate amounts and totals using useMemo
  const calculatedValues = useMemo(() => {
    const lineItems = watchedLineItems || [];
    
    // Calculate individual line item amounts
    const itemsWithCalculatedAmounts = lineItems.map((item) => {
      if (!item) return { 
        amount: "0.00", 
        taxAmount: 0, 
        discount: 0, 
        baseAmount: 0 
      };
      
      const qty = safeParseFloat(item.quantity);
      const price = safeParseFloat(item.unitPrice);
      const discount = safeParseFloat(item.discount || "0");
      
      // Calculate base amount before tax
      const baseAmount = (qty * price) - discount;
      
      // Calculate tax amount
      let taxAmount = 0;
      if (item.taxId) {
        const tax = taxes.find(t => t.id === item.taxId);
        if (tax) {
          taxAmount = baseAmount * (safeParseFloat(tax.rate) / 100);
        }
      }
      
      // Final amount includes tax
      const amount = baseAmount + taxAmount;
      
      return { 
        amount: amount.toFixed(2),
        taxAmount,
        discount,
        baseAmount
      };
    });

    // Calculate totals
    const subtotal = itemsWithCalculatedAmounts.reduce((sum, item) => {
      return sum + item.baseAmount + item.discount;
    }, 0);
    
    const totalDiscount = itemsWithCalculatedAmounts.reduce((sum, item) => {
      return sum + item.discount;
    }, 0);
    
    const totalTax = itemsWithCalculatedAmounts.reduce((sum, item) => {
      return sum + item.taxAmount;
    }, 0);
    
    const total = subtotal - totalDiscount + totalTax;

    return {
      itemsWithCalculatedAmounts,
      subtotal: subtotal.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      totalTax: totalTax.toFixed(2),
      total: total.toFixed(2),
    };
  }, [watchedLineItems, taxes]);

  // Update form values when calculated values change
  useEffect(() => {
    calculatedValues.itemsWithCalculatedAmounts.forEach((item, index) => {
      const currentAmount = form.getValues(`lineItems.${index}.amount`);
      if (currentAmount !== item.amount) {
        form.setValue(`lineItems.${index}.amount`, item.amount, { shouldValidate: false });
      }
    });

    const currentSubtotal = form.getValues('invoice.subtotal');
    const currentTaxAmount = form.getValues('invoice.taxAmount');
    const currentTotal = form.getValues('invoice.total');
    
    if (currentSubtotal !== calculatedValues.subtotal) {
      form.setValue('invoice.subtotal', calculatedValues.subtotal, { shouldValidate: false });
    }
    
    if (currentTaxAmount !== calculatedValues.totalTax) {
      form.setValue('invoice.taxAmount', calculatedValues.totalTax, { shouldValidate: false });
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
        currencyCode: invoice.currencyCode,
        invoiceNumber: invoice.invoiceNumber || "",
        invoiceDate: new Date(invoice.invoiceDate).toISOString().split('T')[0],
        dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
        status: invoice.status,
        invoiceSubject: invoice.invoiceSubject || "",
        poReference: invoice.poReference || "",
        issuerTaxId: invoice.issuerTaxId || "",
        customerTaxId: invoice.customerTaxId || "",
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        notes: invoice.notes || "",
      },
      lineItems: lineItems.length > 0 ? lineItems.map(item => ({
        itemId: item.itemId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || "0.00",
        taxId: item.taxId || null,
        amount: item.amount,
        accountId: item.accountId || null,
      })) : [{
        itemId: null,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        discount: "0.00",
        taxId: null,
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
        currencyCode: baseCurrency?.code || "USD",
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: "draft",
        invoiceSubject: "",
        poReference: "",
        issuerTaxId: companyProfile?.taxRegistrationNumber || "",
        customerTaxId: "",
        subtotal: "0.00",
        taxAmount: "0.00",
        total: "0.00",
        notes: "",
      },
      lineItems: [{
        itemId: null,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        discount: "0.00",
        taxId: null,
        amount: "0.00",
        accountId: null,
      }],
    });
  }, [invoice, currentTenant, companyProfile, baseCurrency, form, open]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        invoice: {
          tenantId: values.invoice.tenantId,
          customerId: values.invoice.customerId,
          currencyCode: values.invoice.currencyCode,
          invoiceNumber: values.invoice.invoiceNumber || undefined,
          invoiceDate: new Date(values.invoice.invoiceDate).toISOString(),
          dueDate: new Date(values.invoice.dueDate).toISOString(),
          status: values.invoice.status,
          invoiceSubject: values.invoice.invoiceSubject || undefined,
          poReference: values.invoice.poReference || undefined,
          issuerTaxId: values.invoice.issuerTaxId || undefined,
          customerTaxId: values.invoice.customerTaxId || undefined,
          subtotal: values.invoice.subtotal,
          taxAmount: values.invoice.taxAmount,
          total: values.invoice.total,
          notes: values.invoice.notes || undefined,
        },
        lineItems: values.lineItems.map(item => ({
          itemId: item.itemId || undefined,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || "0.00",
          taxId: item.taxId || undefined,
          amount: item.amount,
          accountId: item.accountId || undefined,
        })),
      };

      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const res = invoice 
        ? await apiRequest(`/api/invoices/${invoice.id}?tenantId=${currentTenant.id}`, "PATCH", payload)
        : await apiRequest(`/api/invoices?tenantId=${currentTenant.id}`, "POST", payload);
      
      // Parse JSON response
      return await res.json();
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
        title: `Failed to ${invoice ? "update" : "create"} invoice`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveAndSendMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const payload = {
        invoice: {
          tenantId: values.invoice.tenantId,
          customerId: values.invoice.customerId,
          currencyCode: values.invoice.currencyCode,
          invoiceNumber: values.invoice.invoiceNumber || undefined,
          invoiceDate: new Date(values.invoice.invoiceDate).toISOString(),
          dueDate: new Date(values.invoice.dueDate).toISOString(),
          status: values.invoice.status,
          invoiceSubject: values.invoice.invoiceSubject || undefined,
          poReference: values.invoice.poReference || undefined,
          issuerTaxId: values.invoice.issuerTaxId || undefined,
          customerTaxId: values.invoice.customerTaxId || undefined,
          subtotal: values.invoice.subtotal,
          taxAmount: values.invoice.taxAmount,
          total: values.invoice.total,
          notes: values.invoice.notes || undefined,
        },
        lineItems: values.lineItems.map(item => ({
          itemId: item.itemId || undefined,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || "0.00",
          taxId: item.taxId || undefined,
          amount: item.amount,
          accountId: item.accountId || undefined,
        })),
      };

      // First create/update invoice
      const createRes = invoice 
        ? await apiRequest(`/api/invoices/${invoice.id}?tenantId=${currentTenant.id}`, "PATCH", payload)
        : await apiRequest(`/api/invoices?tenantId=${currentTenant.id}`, "POST", payload);
      
      const savedInvoice = await createRes.json();
      
      // Then send email
      const emailRes = await apiRequest(
        `/api/invoices/${savedInvoice.id}/send-email?tenantId=${currentTenant.id}`,
        "POST",
        {}
      );
      
      // Parse JSON once
      const emailData = await emailRes.json().catch(() => ({ error: 'Failed to send email' }));
      
      // Check if response was not ok
      if (!emailRes.ok) {
        throw new Error(emailData.error || 'Failed to send email');
      }
      
      return emailData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", currentTenant?.id] });
      toast({
        title: "Invoice saved and sent successfully",
        description: "The invoice has been created and emailed to the customer.",
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
        title: "Failed to save and send invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  const onSaveAndSend = (values: FormValues) => {
    saveAndSendMutation.mutate(values);
  };

  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);

  // Check if critical data is ready for new invoice creation
  // Require company profile to exist AND have tax registration number
  const isDataReady = !!currentTenant && 
                      !!companyProfile && 
                      !!companyProfile.taxRegistrationNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto" data-testid="dialog-invoice">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
          <DialogDescription>
            {invoice ? "Update invoice information" : "Create a new invoice for your customer"}
          </DialogDescription>
        </DialogHeader>

        {/* Show loading state while critical data loads for new invoices */}
        {!invoice && (!currentTenant || profileLoading) && (
          <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground" data-testid="loading-critical-data">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {lineItemsLoading && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground" data-testid="loading-indicator">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading invoice details...</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Issuer Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Issuer Information</h3>
              {profileLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading company profile...</span>
                </div>
              ) : !companyProfile || !companyProfile.taxRegistrationNumber ? (
                <Alert variant="destructive" data-testid="alert-company-profile-missing">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Company Profile Required</AlertTitle>
                  <AlertDescription>
                    You must set up your company profile with a tax registration number before creating invoices.
                    <Link to="/company-profile" className="underline ml-1" data-testid="link-company-profile">
                      Set up company profile
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-2" data-testid="section-issuer">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Company Legal Name</p>
                      <p className="font-medium" data-testid="text-company-name">{companyProfile.legalName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tax Registration Number</p>
                      <p className="font-medium font-mono" data-testid="text-issuer-tax-id">
                        {companyProfile.taxRegistrationNumber}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Header Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Invoice Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="invoice.invoiceNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Auto-generated" 
                          {...field} 
                          disabled
                          className="bg-muted"
                          data-testid="input-invoice-number" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <FormField
                  control={form.control}
                  name="invoice.invoiceSubject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} data-testid="input-invoice-subject" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="invoice.poReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} data-testid="input-po-reference" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Customer Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Customer Information</h3>
              <div className="grid grid-cols-3 gap-4">
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
                  name="invoice.currencyCode"
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
                <div className="space-y-1">
                  <p className="text-sm font-medium">Customer Tax Registration Number</p>
                  <div className="h-10 px-3 py-2 border rounded-md bg-muted flex items-center">
                    <p className="font-mono text-sm" data-testid="text-customer-tax-id">
                      {selectedCustomer?.taxRegistrationNumber || "Not available"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
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
                    discount: "0.00",
                    taxId: null,
                    amount: "0.00",
                    accountId: null,
                  })}
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      {/* Item Selector */}
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.itemId`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Item</FormLabel>}
                              <Select 
                                onValueChange={(value) => {
                                  field.onChange(value === "custom" ? null : value);
                                  handleItemSelect(value === "custom" ? null : value, index);
                                }}
                                value={field.value || "custom"}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-item-${index}`}>
                                    <SelectValue placeholder="Select item" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="custom">Custom Item</SelectItem>
                                  {items.filter(i => i.isActive).map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Description */}
                      <div className="col-span-3">
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

                      {/* Quantity */}
                      <div className="col-span-1">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Qty *</FormLabel>}
                              <FormControl>
                                <Input type="number" step="0.01" min="0" placeholder="1" {...field} data-testid={`input-quantity-${index}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Price *</FormLabel>}
                              <FormControl>
                                <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} data-testid={`input-unit-price-${index}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Discount */}
                      <div className="col-span-1">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.discount`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Discount</FormLabel>}
                              <FormControl>
                                <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} data-testid={`input-discount-${index}`} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Tax */}
                      <div className="col-span-1">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.taxId`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Tax</FormLabel>}
                              <Select 
                                onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                value={field.value || "none"}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-tax-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {taxes.filter(t => t.isActive).map((tax) => (
                                    <SelectItem key={tax.id} value={tax.id}>
                                      {tax.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Amount */}
                      <div className="col-span-1">
                        <FormField
                          control={form.control}
                          name={`lineItems.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Amount</FormLabel>}
                              <FormControl>
                                <Input readOnly {...field} className="bg-muted font-mono" data-testid={`text-amount-${index}`} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-1 flex items-end justify-center">
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
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Section */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-end gap-4">
                <span className="text-sm text-muted-foreground min-w-32 text-right">Subtotal:</span>
                <span className="font-mono font-medium min-w-24 text-right" data-testid="text-subtotal">
                  {formatCurrency(parseFloat(calculatedValues.subtotal), selectedCurrencyCode || baseCurrency?.code || 'USD', currenciesLoading ? [] : currencies)}
                </span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-sm text-muted-foreground min-w-32 text-right">Total Discount:</span>
                <span className="font-mono font-medium min-w-24 text-right text-destructive" data-testid="text-total-discount">
                  -{formatCurrency(parseFloat(calculatedValues.totalDiscount), selectedCurrencyCode || baseCurrency?.code || 'USD', currenciesLoading ? [] : currencies)}
                </span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="text-sm text-muted-foreground min-w-32 text-right">Total Tax:</span>
                <span className="font-mono font-medium min-w-24 text-right" data-testid="text-total-tax">
                  {formatCurrency(parseFloat(calculatedValues.totalTax), selectedCurrencyCode || baseCurrency?.code || 'USD', currenciesLoading ? [] : currencies)}
                </span>
              </div>
              <div className="flex justify-end gap-4 pt-2 border-t">
                <span className="text-lg font-semibold min-w-32 text-right">Total Amount:</span>
                <span className="text-lg font-mono font-bold min-w-24 text-right" data-testid="text-total">
                  {formatCurrency(parseFloat(calculatedValues.total), selectedCurrencyCode || baseCurrency?.code || 'USD', currenciesLoading ? [] : currencies)}
                </span>
              </div>
            </div>

            {/* Notes Section */}
            <FormField
              control={form.control}
              name="invoice.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." rows={3} {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <DialogFooter className="gap-2">
              {invoice && currentTenant && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(`/api/invoices/${invoice.id}/pdf?tenantId=${currentTenant.id}`, '_blank')}
                  data-testid="button-download-pdf-dialog"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button 
                        type="submit" 
                        variant="outline"
                        disabled={!isDataReady || saveMutation.isPending || lineItemsLoading || currenciesLoading || currenciesError} 
                        data-testid="button-save-draft"
                      >
                        {saveMutation.isPending ? "Saving..." : "Save as Draft"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isDataReady && (
                    <TooltipContent>
                      <p>Complete company profile first</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button 
                        type="button"
                        onClick={form.handleSubmit(onSaveAndSend)}
                        disabled={!isDataReady || saveAndSendMutation.isPending || lineItemsLoading || currenciesLoading || currenciesError} 
                        data-testid="button-save-send"
                      >
                        {saveAndSendMutation.isPending ? "Sending..." : "Save & Send"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isDataReady && (
                    <TooltipContent>
                      <p>Complete company profile first</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
