import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { customerFormSchema, type CustomerFormValues, type Customer, type InsertCustomer } from "@shared/schema";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useTenant } from "@/hooks/useTenant";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export function CustomerDialog({ open, onOpenChange, customer }: CustomerDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [copyFromBilling, setCopyFromBilling] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(
      customer
        ? customerFormSchema.partial()
        : customerFormSchema
    ),
    defaultValues: {
      // NO tenantId in form state - security fix
      name: "",
      email: "",
      phone: "",
      company: "",
      displayName: "",
      website: "",
      taxRegistrationNumber: "",
      customerType: "business",
      paymentTerms: 30,
      currencyCode: "USD",
      billingAddress: {},
      shippingAddress: {},
      contactPersons: [],
      address: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        // Edit mode - NO tenantId in form
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        company: customer.company || "",
        displayName: customer.displayName || "",
        website: customer.website || "",
        taxRegistrationNumber: customer.taxRegistrationNumber || "",
        customerType: customer.customerType || "business",
        paymentTerms: customer.paymentTerms || 30,
        currencyCode: customer.currencyCode || "USD",
        billingAddress: customer.billingAddress || {},
        shippingAddress: customer.shippingAddress || {},
        contactPersons: customer.contactPersons || [],
        address: customer.address || "",
        notes: customer.notes || "",
      });
    } else {
      form.reset({
        // Create mode - NO tenantId in form
        name: "",
        email: "",
        phone: "",
        company: "",
        displayName: "",
        website: "",
        taxRegistrationNumber: "",
        customerType: "business",
        paymentTerms: 30,
        currencyCode: "USD",
        billingAddress: {},
        shippingAddress: {},
        contactPersons: [],
        address: "",
        notes: "",
      });
    }
    setCopyFromBilling(false);
  }, [customer, form]);

  const name = form.watch("name");
  const company = form.watch("company");
  const billingWatch = form.watch("billingAddress");
  const shippingDisabled = copyFromBilling;

  useEffect(() => {
    const current = form.getValues("displayName");
    if (!current && (name || company)) {
      const display = company ? `${company}${name ? ' - ' + name : ''}` : name;
      form.setValue("displayName", display);
    }
  }, [name, company, form]);

  useEffect(() => {
    if (copyFromBilling && billingWatch) {
      form.setValue("shippingAddress", structuredClone(billingWatch));
    }
  }, [copyFromBilling, billingWatch, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: InsertCustomer | CustomerFormValues) => {
      if (customer) {
        return apiRequest(`/api/customers/${customer.id}`, "PATCH", data);
      } else {
        return apiRequest("/api/customers", "POST", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", currentTenant?.id] });
      toast({
        title: customer ? "Customer updated" : "Customer created",
        description: `Customer has been ${customer ? "updated" : "created"} successfully.`,
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
        description: `Failed to ${customer ? "update" : "create"} customer.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CustomerFormValues) => {
    // Sanitize payload: remove empty address objects
    const sanitized = {
      ...values,
      billingAddress: values.billingAddress && Object.keys(values.billingAddress).length > 0 
        ? values.billingAddress 
        : undefined,
      shippingAddress: values.shippingAddress && Object.keys(values.shippingAddress).length > 0 
        ? values.shippingAddress 
        : undefined,
      contactPersons: values.contactPersons && values.contactPersons.length > 0 
        ? values.contactPersons 
        : undefined,
    };

    if (customer) {
      // PATCH: Send sanitized without tenantId
      saveMutation.mutate(sanitized);
    } else {
      // POST: Add tenantId
      saveMutation.mutate({ ...sanitized, tenantId: currentTenant?.id! });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="dialog-customer">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          <DialogDescription>
            {customer ? "Update customer information" : "Add a new customer to your workspace"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic" data-testid="tab-basic">Basic Details</TabsTrigger>
                <TabsTrigger value="billing" data-testid="tab-billing">Billing Address</TabsTrigger>
                <TabsTrigger value="shipping" data-testid="tab-shipping">Shipping Address</TabsTrigger>
                <TabsTrigger value="other" data-testid="tab-other">Other Details</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Display name" {...field} data-testid="input-display-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          data-testid="radio-customer-type"
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="business" id="business" data-testid="radio-business" />
                            <Label htmlFor="business">Business</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="individual" id="individual" data-testid="radio-individual" />
                            <Label htmlFor="individual">Individual</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} data-testid="input-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxRegistrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Registration Number (TRN)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter tax registration number" {...field} data-testid="input-tax-registration-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="billing" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="billingAddress.attention"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attention</FormLabel>
                      <FormControl>
                        <Input placeholder="Attention to" {...field} data-testid="input-billing-attention" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingAddress.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} data-testid="input-billing-street" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billingAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} data-testid="input-billing-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} data-testid="input-billing-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billingAddress.zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="ZIP Code" {...field} data-testid="input-billing-zip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billingAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country" {...field} data-testid="input-billing-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="shipping" className="space-y-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={copyFromBilling}
                    onCheckedChange={(checked) => setCopyFromBilling(checked as boolean)}
                    data-testid="checkbox-copy-from-billing"
                  />
                  <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Copy from Billing Address
                  </Label>
                </div>
                <FormField
                  control={form.control}
                  name="shippingAddress.attention"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attention</FormLabel>
                      <FormControl>
                        <Input placeholder="Attention to" {...field} disabled={shippingDisabled} data-testid="input-shipping-attention" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippingAddress.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} disabled={shippingDisabled} data-testid="input-shipping-street" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="shippingAddress.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} disabled={shippingDisabled} data-testid="input-shipping-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shippingAddress.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} disabled={shippingDisabled} data-testid="input-shipping-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="shippingAddress.zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP</FormLabel>
                        <FormControl>
                          <Input placeholder="ZIP Code" {...field} disabled={shippingDisabled} data-testid="input-shipping-zip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shippingAddress.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country" {...field} disabled={shippingDisabled} data-testid="input-shipping-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="other" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="30"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 30)}
                            data-testid="input-payment-terms"
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      </FormControl>
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
                          <SelectTrigger data-testid="select-currency-trigger">
                            <SelectValue placeholder="Select currency" data-testid="select-currency-value" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD" data-testid="select-currency-usd">USD - US Dollar</SelectItem>
                          <SelectItem value="CAD" data-testid="select-currency-cad">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="EUR" data-testid="select-currency-eur">EUR - Euro</SelectItem>
                          <SelectItem value="GBP" data-testid="select-currency-gbp">GBP - British Pound</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Textarea placeholder="Additional notes..." {...field} data-testid="textarea-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-customer">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-customer">
                {saveMutation.isPending ? "Saving..." : (customer ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
