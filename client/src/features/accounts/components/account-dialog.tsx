import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertAccountSchema, type Account } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { useTenant } from "@/shared/hooks/useTenant";

// Use insertAccountSchema directly - it already omits code, tenantId, currentBalance, etc.
const formSchema = insertAccountSchema;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
}

export function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "asset",
      accountCategory: "",
      subtype: "",
      parentId: "",
      description: "",
      openingBalance: "0",
      isActive: true,
      cashFlowClassification: "none",
      isCashEquivalent: false,
      cashEquivalentMaturityDays: null,
    },
  });

  useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        type: account.type,
        accountCategory: account.accountCategory || "",
        subtype: account.subtype || "",
        parentId: account.parentId || "",
        description: account.description || "",
        openingBalance: account.openingBalance,
        isActive: account.isActive ?? true,
        cashFlowClassification: account.cashFlowClassification || "none",
        isCashEquivalent: account.isCashEquivalent || false,
        cashEquivalentMaturityDays: account.cashEquivalentMaturityDays || null,
      });
    } else {
      form.reset({
        name: "",
        type: "asset",
        accountCategory: "",
        subtype: "",
        parentId: "",
        description: "",
        openingBalance: "0",
        isActive: true,
        cashFlowClassification: "none",
        isCashEquivalent: false,
        cashEquivalentMaturityDays: null,
      });
    }
  }, [account, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const payload = {
        tenantId: currentTenant?.id,
        ...values,
      };
      if (account) {
        return await apiRequest(`/api/accounts/${account.id}`, "PATCH", payload);
      }
      return await apiRequest("/api/accounts", "POST", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/accounts", { tenantId: currentTenant?.id }] });
      toast({
        title: account ? "Account updated" : "Account created",
        description: `Account has been ${account ? "updated" : "created"} successfully.`,
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
        description: `Failed to ${account ? "update" : "create"} account.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveMutation.mutate(values);
  };

  const availableParentAccounts = accounts.filter((a) => a.id !== account?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-account">
        <DialogHeader>
          <DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {account ? "Update account information" : "Add a new account to your chart of accounts"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic" data-testid="tab-basic-details">Basic Details</TabsTrigger>
                <TabsTrigger value="additional" data-testid="tab-additional-info">Additional Info</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Cash in Bank" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="asset" data-testid="select-option-asset">Asset</SelectItem>
                          <SelectItem value="liability" data-testid="select-option-liability">Liability</SelectItem>
                          <SelectItem value="equity" data-testid="select-option-equity">Equity</SelectItem>
                          <SelectItem value="income" data-testid="select-option-income">Income</SelectItem>
                          <SelectItem value="expense" data-testid="select-option-expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The primary category for this account
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Current Assets, Fixed Assets" {...field} data-testid="input-account-category" />
                      </FormControl>
                      <FormDescription>
                        Subcategory for better organization (e.g., Current Assets, Fixed Assets)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this account..."
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                <FormField
                  control={form.control}
                  name="subtype"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtype</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., current_asset, fixed_asset" {...field} data-testid="input-subtype" />
                      </FormControl>
                      <FormDescription>
                        Further classification of the account type
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Account</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? "" : value)} 
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-parent-account">
                            <SelectValue placeholder="Select parent account (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="select-option-no-parent">No Parent</SelectItem>
                          {availableParentAccounts.map((parentAccount) => (
                            <SelectItem
                              key={parentAccount.id}
                              value={parentAccount.id}
                              data-testid={`select-option-parent-${parentAccount.id}`}
                            >
                              {parentAccount.code} - {parentAccount.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Link this account to a parent account for hierarchical organization
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="openingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Balance</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            className="pl-7"
                            data-testid="input-opening-balance"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Initial balance when creating this account
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-active"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Active Account
                        </FormLabel>
                        <FormDescription>
                          Inactive accounts won't appear in transaction dropdowns
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cashFlowClassification"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash Flow Classification (IAS 7)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-cash-flow-classification">
                            <SelectValue placeholder="Select classification" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="select-option-none">None</SelectItem>
                          <SelectItem value="operating" data-testid="select-option-operating">Operating</SelectItem>
                          <SelectItem value="investing" data-testid="select-option-investing">Investing</SelectItem>
                          <SelectItem value="financing" data-testid="select-option-financing">Financing</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the cash flow statement category for this account (IAS 7)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isCashEquivalent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-cash-equivalent"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          This is a cash equivalent
                        </FormLabel>
                        <FormDescription>
                          Highly liquid investments with maturity ≤90 days (IAS 7.7)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("isCashEquivalent") && (
                  <FormField
                    control={form.control}
                    name="cashEquivalentMaturityDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maturity Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="90"
                            placeholder="e.g., 30"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-cash-equivalent-maturity-days"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum maturity period in days (must be ≤90 days)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
                {saveMutation.isPending ? "Saving..." : (account ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
