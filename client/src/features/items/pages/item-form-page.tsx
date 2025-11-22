import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Separator } from "@/shared/components/ui/separator";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { insertItemSchema, type Item, type Account, type Tax } from "@shared/schema";

const formSchema = insertItemSchema.extend({
  quantityOnHand: z.string().refine(
    (val) => {
      const num = parseFloat(val || "0");
      return !isNaN(num) && num >= 0;
    },
    { message: "Must be 0 or greater" }
  ),
  reorderLevel: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Must be 0 or greater" }
  ),
  purchasePrice: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Must be 0 or greater" }
  ),
  rate: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Sale price must be greater than 0" }
  ),
});

type FormValues = z.infer<typeof formSchema>;

export default function ItemFormPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  const isEdit = !!id;

  const canCreate = hasPermission("items.create");
  const canUpdate = hasPermission("items.update");

  // Permission check - must have create permission for new items, update permission for editing
  if (isEdit && !canUpdate) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Permission Denied</h2>
          <p className="text-muted-foreground">You don't have permission to edit items</p>
        </div>
      </div>
    );
  }

  if (!isEdit && !canCreate) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Permission Denied</h2>
          <p className="text-muted-foreground">You don't have permission to create items</p>
        </div>
      </div>
    );
  }

  const { data: item, isLoading: itemLoading } = useQuery<Item>({
    queryKey: ["/api/items", id, { tenantId: currentTenant?.id }],
    enabled: !!id && !!currentTenant?.id,
    queryFn: async () => {
      const response = await fetch(`/api/items/${id}?tenantId=${currentTenant?.id}`);
      if (!response.ok) throw new Error("Failed to fetch item");
      return response.json();
    },
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: taxes = [] } = useQuery<Tax[]>({
    queryKey: ["/api/taxes", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      rate: "0",
      purchasePrice: "",
      unit: "",
      type: "goods",
      accountId: "",
      taxId: "",
      quantityOnHand: "0",
      reorderLevel: "",
      isActive: true,
      tenantId: currentTenant?.id || "",
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || "",
        sku: item.sku || "",
        rate: item.rate,
        purchasePrice: item.purchasePrice || "",
        unit: item.unit || "",
        type: item.type,
        accountId: item.accountId || "",
        taxId: item.taxId || "",
        quantityOnHand: item.quantityOnHand || "0",
        reorderLevel: item.reorderLevel || "",
        isActive: item.isActive ?? true,
        tenantId: currentTenant?.id || "",
      });
    }
  }, [item, form, currentTenant?.id]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const payload = {
        ...values,
        tenantId: currentTenant.id,
      };

      if (isEdit) {
        return await apiRequest(`/api/items/${id}`, "PATCH", payload);
      }
      return await apiRequest("/api/items", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: isEdit ? "Item updated" : "Item created",
        description: `Item has been ${isEdit ? "updated" : "created"} successfully.`,
      });
      navigate("/inventory/items");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEdit ? "update" : "create"} item.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    saveMutation.mutate(values);
  };

  if (isEdit && itemLoading) {
    return <TableSkeleton rows={10} columns={[]} minHeight="600px" />;
  }

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-muted-foreground">Please select or create an organization to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/inventory/items">
          <Button variant="ghost" size="icon" data-testid="button-back" aria-label="Back to items" title="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">{isEdit ? "Edit Item" : "New Item"}</h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update item information" : "Add a new product or service to your inventory"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>General details about the item</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Product or Service Name" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="Stock Keeping Unit" {...field} data-testid="input-sku" />
                      </FormControl>
                      <FormDescription>Unique product identifier</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of the item..."
                        {...field}
                        rows={3}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="goods">Goods</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., pcs, hrs, kg" {...field} data-testid="input-unit" />
                      </FormControl>
                      <FormDescription>Measurement unit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>Item is available for sale</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>Set sale price, purchase price, and tax</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Price (Rate) *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            className="pl-7"
                            data-testid="input-rate"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Default selling price</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            className="pl-7"
                            data-testid="input-purchase-price"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>Cost per unit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tax">
                            <SelectValue placeholder="Select tax" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No Tax</SelectItem>
                          {taxes.map((tax) => (
                            <SelectItem key={tax.id} value={tax.id}>
                              {tax.name} ({tax.rate}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Tracking</CardTitle>
              <CardDescription>Manage stock levels and reorder points</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantityOnHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity on Hand</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          data-testid="input-quantity-on-hand"
                        />
                      </FormControl>
                      <FormDescription>Current stock level</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          data-testid="input-reorder-level"
                        />
                      </FormControl>
                      <FormDescription>Alert when stock reaches this level</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounting</CardTitle>
              <CardDescription>Link to chart of accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No Account</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Revenue/expense account for this item
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex items-center justify-end gap-4">
            <Link href="/inventory/items">
              <Button type="button" variant="outline" data-testid="button-cancel">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : (isEdit ? "Update Item" : "Create Item")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
