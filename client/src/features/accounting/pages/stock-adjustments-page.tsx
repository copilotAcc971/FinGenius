import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package, Plus, Minus, ArrowRight, History } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Separator } from "@/shared/components/ui/separator";
import { Badge } from "@/shared/components/ui/badge";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { Item } from "@shared/schema";

const adjustmentSchema = z.object({
  itemId: z.string().min(1, "Please select an item"),
  adjustmentType: z.enum(["increase", "decrease"]),
  adjustmentQuantity: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: "Adjustment quantity must be greater than 0" }
  ),
  reason: z.enum(["physical_count", "damage", "loss", "return", "other"]),
  notes: z.string().optional(),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

export default function StockAdjustmentsPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const { data: items = [], isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      itemId: "",
      adjustmentType: "increase",
      adjustmentQuantity: "",
      reason: "physical_count",
      notes: "",
    },
  });

  const watchedItemId = form.watch("itemId");
  const watchedAdjustmentType = form.watch("adjustmentType");
  const watchedAdjustmentQuantity = form.watch("adjustmentQuantity");

  useMemo(() => {
    if (watchedItemId) {
      const item = items.find(i => i.id === watchedItemId);
      setSelectedItem(item || null);
    } else {
      setSelectedItem(null);
    }
  }, [watchedItemId, items]);

  const calculateNewQuantity = () => {
    if (!selectedItem) return "0.00";
    const currentQty = parseFloat(selectedItem.quantityOnHand || "0");
    const adjustment = parseFloat(watchedAdjustmentQuantity || "0");
    
    if (watchedAdjustmentType === "increase") {
      return (currentQty + adjustment).toFixed(2);
    } else {
      return Math.max(0, currentQty - adjustment).toFixed(2);
    }
  };

  const adjustmentMutation = useMutation({
    mutationFn: async (values: AdjustmentFormValues) => {
      if (!currentTenant?.id || !selectedItem) throw new Error("Missing required data");

      const currentQty = parseFloat(selectedItem.quantityOnHand || "0");
      const adjustment = parseFloat(values.adjustmentQuantity);
      
      let newQuantity: number;
      if (values.adjustmentType === "increase") {
        newQuantity = currentQty + adjustment;
      } else {
        newQuantity = Math.max(0, currentQty - adjustment);
      }

      const payload = {
        tenantId: currentTenant.id,
        quantityOnHand: newQuantity.toString(),
      };

      return await apiRequest(`/api/items/${selectedItem.id}`, "PATCH", payload);
    },
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: "Stock adjusted",
        description: `${selectedItem?.name} quantity has been ${values.adjustmentType}d successfully.`,
      });
      
      form.reset({
        itemId: "",
        adjustmentType: "increase",
        adjustmentQuantity: "",
        reason: "physical_count",
        notes: "",
      });
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust stock.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: AdjustmentFormValues) => {
    adjustmentMutation.mutate(values);
  };

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
      <div>
        <h1 className="text-3xl font-semibold">Stock Adjustments</h1>
        <p className="text-muted-foreground">
          Increase or decrease inventory quantities for physical counts, damage, loss, or returns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Adjustment Details</CardTitle>
                  <CardDescription>Select an item and specify the adjustment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="itemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-item">
                              <SelectValue placeholder="Select an item" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <div className="flex items-center gap-2">
                                  <span>{item.name}</span>
                                  {item.sku && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      ({item.sku})
                                    </span>
                                  )}
                                </div>
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
                    name="adjustmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adjustment Type *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="increase" id="increase" data-testid="radio-increase" />
                              <label htmlFor="increase" className="flex items-center gap-2 cursor-pointer">
                                <Plus className="h-4 w-4 text-green-600" />
                                <span>Increase</span>
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="decrease" id="decrease" data-testid="radio-decrease" />
                              <label htmlFor="decrease" className="flex items-center gap-2 cursor-pointer">
                                <Minus className="h-4 w-4 text-red-600" />
                                <span>Decrease</span>
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adjustmentQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adjustment Quantity *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            {...field}
                            data-testid="input-adjustment-quantity"
                          />
                        </FormControl>
                        <FormDescription>
                          Amount to {watchedAdjustmentType} inventory by
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reason">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="physical_count">Physical Count</SelectItem>
                            <SelectItem value="damage">Damage</SelectItem>
                            <SelectItem value="loss">Loss</SelectItem>
                            <SelectItem value="return">Customer Return</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
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
                          <Textarea
                            placeholder="Additional notes about this adjustment..."
                            {...field}
                            rows={3}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setSelectedItem(null);
                  }}
                  data-testid="button-reset"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={adjustmentMutation.isPending || !selectedItem}
                  data-testid="button-submit"
                >
                  {adjustmentMutation.isPending ? "Processing..." : "Apply Adjustment"}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="space-y-6">
          {selectedItem ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Stock</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Item</div>
                    <div className="font-semibold">{selectedItem.name}</div>
                    {selectedItem.sku && (
                      <div className="text-xs font-mono text-muted-foreground">
                        SKU: {selectedItem.sku}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Current Quantity</div>
                    <div className="text-2xl font-bold font-mono">
                      {parseFloat(selectedItem.quantityOnHand || "0").toFixed(2)}
                      {selectedItem.unit && (
                        <span className="text-sm text-muted-foreground ml-2">{selectedItem.unit}</span>
                      )}
                    </div>
                  </div>

                  {selectedItem.reorderLevel && parseFloat(selectedItem.reorderLevel) > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Reorder Level</div>
                      <div className="font-mono">
                        {parseFloat(selectedItem.reorderLevel).toFixed(2)}
                      </div>
                      {parseFloat(selectedItem.quantityOnHand || "0") <= parseFloat(selectedItem.reorderLevel) && (
                        <Badge variant="destructive" className="mt-2">
                          Low Stock
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {watchedAdjustmentQuantity && parseFloat(watchedAdjustmentQuantity) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current</span>
                      <span className="font-mono font-semibold">
                        {parseFloat(selectedItem.quantityOnHand || "0").toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-center py-2">
                      <ArrowRight className={`h-5 w-5 ${watchedAdjustmentType === 'increase' ? 'text-green-600' : 'text-red-600'}`} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">New Quantity</span>
                      <span className={`font-mono font-bold text-xl ${watchedAdjustmentType === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                        {calculateNewQuantity()}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Change</span>
                      <span className={`font-mono font-semibold ${watchedAdjustmentType === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                        {watchedAdjustmentType === 'increase' ? '+' : '-'}
                        {parseFloat(watchedAdjustmentQuantity).toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  Select an item to view current stock and preview adjustments
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
