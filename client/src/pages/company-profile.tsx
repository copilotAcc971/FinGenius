import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Save, Building2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { insertTenantCompanyProfileSchema, type TenantCompanyProfile, type InsertTenantCompanyProfile } from "@shared/schema";
import { z } from "zod";

const companyProfileFormSchema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  taxRegistrationNumber: z.string().min(1, "Tax registration number is required"),
  address: z.object({
    street: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    state: z.string().optional().or(z.literal("")),
    zip: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
  }).optional(),
  email: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  ifrsComplianceEnabled: z.boolean().optional(),
  fxTranslationStandard: z.string().optional(),
  fxIncomeExpenseMethod: z.string().optional(),
  fxGainAccountId: z.string().optional(),
  fxLossAccountId: z.string().optional(),
});

type CompanyProfileFormValues = z.infer<typeof companyProfileFormSchema>;

export default function CompanyProfile() {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data: profile, isLoading } = useQuery<TenantCompanyProfile | null>({
    queryKey: ['/api/company-profile', { tenantId: tenantId || '' }],
    enabled: !!tenantId,
  });

  const form = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileFormSchema),
    defaultValues: {
      legalName: "",
      taxRegistrationNumber: "",
      address: {
        street: "",
        city: "",
        state: "",
        zip: "",
        country: "",
      },
      email: "",
      phone: "",
      website: "",
      ifrsComplianceEnabled: false,
      fxTranslationStandard: "ifrs-sme",
      fxIncomeExpenseMethod: "transaction-date",
      fxGainAccountId: "",
      fxLossAccountId: "",
    },
  });

  useEffect(() => {
    if (profile) {
      const addr = profile.address || {};
      form.reset({
        legalName: profile.legalName ?? "",
        taxRegistrationNumber: profile.taxRegistrationNumber ?? "",
        address: {
          street: addr.street ?? "",
          city: addr.city ?? "",
          state: addr.state ?? "",
          zip: addr.zip ?? "",
          country: addr.country ?? "",
        },
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        website: profile.website ?? "",
        ifrsComplianceEnabled: profile.ifrsComplianceEnabled ?? false,
        fxTranslationStandard: profile.fxTranslationStandard ?? "ifrs-sme",
        fxIncomeExpenseMethod: profile.fxIncomeExpenseMethod ?? "transaction-date",
        fxGainAccountId: profile.fxGainAccountId ?? "",
        fxLossAccountId: profile.fxLossAccountId ?? "",
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyProfileFormValues) => {
      if (!tenantId) throw new Error("No tenant selected");
      
      const url = `/api/company-profile?tenantId=${tenantId}`;
      if (profile) {
        const res = await apiRequest(url, "PATCH", data);
        return await res.json();
      } else {
        const res = await apiRequest(url, "POST", { ...data, tenantId });
        return await res.json();
      }
    },
    onSuccess: () => {
      // Invalidate company profile cache
      queryClient.invalidateQueries({ 
        queryKey: ['/api/company-profile', { tenantId: tenantId || '' }] 
      });
      // Invalidate all report caches to ensure they refetch with updated IFRS settings
      // Use exact: false to match queries with parameters (e.g., startDate, endDate)
      queryClient.invalidateQueries({ 
        queryKey: ['/api/reports/profit-loss'],
        exact: false
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/reports/balance-sheet'],
        exact: false
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/reports/trial-balance'],
        exact: false
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/reports/cash-flow'],
        exact: false
      });
      toast({
        title: profile ? "Profile updated" : "Profile created",
        description: `Company profile has been ${profile ? "updated" : "created"} successfully.`,
      });
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
        title: `Failed to ${profile ? "update" : "create"} company profile`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CompanyProfileFormValues) => {
    saveMutation.mutate(values);
  };

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground">Please select or create a workspace to continue</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Company Profile</h1>
        <p className="text-muted-foreground">Manage your company information for invoices and tax compliance</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Legal name is required and will appear on invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corporation" {...field} data-testid="input-legal-name" />
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
                    <FormLabel>Tax Registration Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., GST123456789, VAT987654321" {...field} data-testid="input-tax-registration-number" />
                    </FormControl>
                    <FormDescription>
                      Required for creating invoices. Enter your GST, VAT, or other tax registration number.
                    </FormDescription>
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
                        <Input type="email" placeholder="company@example.com" {...field} data-testid="input-email" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company Address</CardTitle>
              <CardDescription>
                This address will appear on invoices and official documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St, Suite 100" {...field} data-testid="input-address-street" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} data-testid="input-address-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} data-testid="input-address-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address.zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="ZIP Code" {...field} data-testid="input-address-zip" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address.country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} data-testid="input-address-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                IFRS Compliance
              </CardTitle>
              <CardDescription>
                Choose your accounting complexity level for multi-currency transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">IFRS Compliance</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable full International Financial Reporting Standards (IFRS) compliance for your accounting
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="ifrsComplianceEnabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value || false}
                            onCheckedChange={field.onChange}
                            data-testid="switch-ifrs-compliance"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Alert>
                  <AlertTitle>What does this mean?</AlertTitle>
                  <AlertDescription>
                    {form.watch("ifrsComplianceEnabled") ? (
                      <>
                        <strong>IFRS Mode Enabled:</strong> Your financial statements will comply with IAS 21
                        and other IFRS standards. This includes:
                        <ul className="list-disc ml-5 mt-2">
                          <li>Transaction-date exchange rates as the default</li>
                          <li>Strict foreign currency translation rules</li>
                          <li>Detailed exchange difference disclosures</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <strong>Standard Mode:</strong> Simplified multi-currency accounting without strict IFRS
                        requirements. You can use average rates freely and conversion is more flexible.
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                {form.watch("ifrsComplianceEnabled") && (
                  <div className="space-y-4 mt-4 pl-4 border-l-2">
                    <FormField
                      control={form.control}
                      name="fxTranslationStandard"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFRS Translation Standard</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "ifrs-sme"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-fx-standard">
                                <SelectValue placeholder="Select standard" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="full-ifrs">Full IFRS (IAS 21)</SelectItem>
                              <SelectItem value="ifrs-sme">IFRS for SMEs (Section 30)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose the accounting standard for foreign currency translation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fxIncomeExpenseMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Income/Expense Translation Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "transaction-date"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-fx-method">
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="average-rate">Average Rate</SelectItem>
                              <SelectItem value="transaction-date">Transaction Date Rate (IFRS Default)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Transaction date rate is the default for IFRS compliance
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fxGainAccountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>FX Gain Account (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Account ID for FX gains" {...field} data-testid="input-fx-gain-account" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fxLossAccountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>FX Loss Account (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Account ID for FX losses" {...field} data-testid="input-fx-loss-account" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save-profile"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
