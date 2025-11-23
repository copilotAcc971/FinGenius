import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { insertFixedAssetSchema, type FixedAsset, type Account } from "@shared/schema";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { useTenant } from "@/shared/hooks/useTenant";

const formSchema = insertFixedAssetSchema.omit({ tenantId: true, accumulatedDepreciation: true });

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
}

export function AssetDialog({ open, onOpenChange, asset }: AssetDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      purchaseDate: new Date(),
      purchasePrice: "0",
      salvageValue: "0",
      depreciationMethod: "straight_line",
      usefulLife: 12,
      status: "active",
      description: "",
      notes: "",
      disposalDate: null,
      disposalAmount: null,
      assetAccountId: null,
      depreciationAccountId: null,
    },
  });

  // Fetch accounts for dropdowns
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open,
  });

  // Filter asset accounts (type: asset)
  const assetAccounts = accounts.filter(account => account.type === "asset");
  // Filter expense accounts for depreciation
  const expenseAccounts = accounts.filter(account => account.type === "expense");

  useEffect(() => {
    if (asset) {
      // Validate purchaseDate to ensure it's a valid Date object
      const purchaseDate = asset.purchaseDate instanceof Date && !isNaN(asset.purchaseDate.getTime())
        ? asset.purchaseDate
        : new Date();

      // Validate disposalDate to ensure it's a valid Date object or null
      const disposalDate = asset.disposalDate instanceof Date && !isNaN(asset.disposalDate.getTime())
        ? asset.disposalDate
        : null;

      form.reset({
        name: asset.name,
        category: asset.category || "",
        purchaseDate,
        purchasePrice: asset.purchasePrice,
        salvageValue: asset.salvageValue || "0",
        depreciationMethod: asset.depreciationMethod as "straight_line" | "declining_balance" | "units_of_production",
        usefulLife: asset.usefulLife || 12,
        status: asset.status as "active" | "disposed" | "sold",
        description: asset.description || "",
        notes: asset.notes || "",
        disposalDate,
        disposalAmount: asset.disposalAmount || null,
        assetAccountId: asset.assetAccountId || null,
        depreciationAccountId: asset.depreciationAccountId || null,
      });
    } else {
      form.reset({
        name: "",
        category: "",
        purchaseDate: new Date(),
        purchasePrice: "0",
        salvageValue: "0",
        depreciationMethod: "straight_line",
        usefulLife: 12,
        status: "active",
        description: "",
        notes: "",
        disposalDate: null,
        disposalAmount: null,
        assetAccountId: null,
        depreciationAccountId: null,
      });
    }
  }, [asset, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const payload = {
        ...values,
        tenantId: currentTenant?.id,
      };
      if (asset) {
        return await apiRequest(`/api/assets/${asset.id}`, "PATCH", payload);
      }
      return await apiRequest("/api/assets", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets", { tenantId: currentTenant?.id }] });
      toast({
        title: asset ? "Asset updated" : "Asset created",
        description: `Asset has been ${asset ? "updated" : "created"} successfully.`,
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
        description: `Failed to ${asset ? "update" : "create"} asset.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log("✅ Form submitted! Values:", values);
    console.log("Form validation errors:", form.formState.errors);
    saveMutation.mutate(values);
  };

  const status = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="dialog-asset">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit Asset" : "Add Asset"}</DialogTitle>
          <DialogDescription>
            {asset ? "Update asset information and depreciation details" : "Add a new fixed asset with depreciation tracking"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic" data-testid="tab-basic-details">Basic Details</TabsTrigger>
                <TabsTrigger value="depreciation" data-testid="tab-depreciation">Depreciation</TabsTrigger>
                <TabsTrigger value="additional" data-testid="tab-additional-info">Additional Info</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Dell Laptop, Office Desk" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Computer Equipment, Furniture" {...field} data-testid="input-category" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            data-testid="input-purchase-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="disposed">Disposed</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
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
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-purchase-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salvageValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salvage Value</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-salvage-value"
                          />
                        </FormControl>
                        <FormDescription>Expected value at end of useful life</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="depreciation" className="space-y-4">
                <FormField
                  control={form.control}
                  name="depreciationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Method *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-depreciation-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="straight_line">Straight Line</SelectItem>
                          <SelectItem value="declining_balance">Declining Balance</SelectItem>
                          <SelectItem value="units_of_production">Units of Production</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="usefulLife"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Useful Life (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="12"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-useful-life"
                        />
                      </FormControl>
                      <FormDescription>Expected lifespan in months</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assetAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-asset-account">
                            <SelectValue placeholder="Select asset account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assetAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Chart of Accounts - Asset</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="depreciationAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Expense Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-depreciation-account">
                            <SelectValue placeholder="Select depreciation account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Chart of Accounts - Expense</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="additional" className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed description of the asset"
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
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
                        <Textarea
                          placeholder="Additional notes"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(status === "disposed" || status === "sold") && (
                  <>
                    <FormField
                      control={form.control}
                      name="disposalDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : (field.value || '')}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                              data-testid="input-disposal-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="disposalAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => field.onChange(e.target.value || null)}
                              data-testid="input-disposal-amount"
                            />
                          </FormControl>
                          <FormDescription>
                            {status === "sold" ? "Sale amount" : "Disposal amount"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
                {saveMutation.isPending ? "Saving..." : asset ? "Update Asset" : "Create Asset"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
