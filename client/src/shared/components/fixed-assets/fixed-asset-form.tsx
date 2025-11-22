import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFixedAssetSchema } from "@shared/schema";
import type { InsertFixedAsset, FixedAsset } from "@shared/schema";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { useToast } from "@/shared/hooks/use-toast";
import { Button } from "@/shared/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Calculator, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";

// Extend the schema with validation rules
const fixedAssetFormSchema = insertFixedAssetSchema.extend({
  name: z.string().min(1, "Name is required"),
  acquisitionCost: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
  salvageValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
  usefulLifeYears: z.number().min(1, "Useful life must be at least 1 year"),
  decliningBalanceRate: z.number().min(0).max(100).optional(),
  acquisitionDate: z.string().min(1, "Acquisition date is required"),
});

type FormData = z.infer<typeof fixedAssetFormSchema>;

interface FixedAssetFormProps {
  asset?: FixedAsset;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function FixedAssetForm({ asset, onSuccess, onCancel }: FixedAssetFormProps) {
  const { toast } = useToast();
  const [previewSchedule, setPreviewSchedule] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(fixedAssetFormSchema),
    defaultValues: {
      name: asset?.name || "",
      description: asset?.description || "",
      category: asset?.category || "",
      acquisitionDate: asset?.acquisitionDate ? format(new Date(asset.acquisitionDate), "yyyy-MM-dd") : "",
      acquisitionCost: asset?.acquisitionCost || "",
      salvageValue: asset?.salvageValue || "0",
      usefulLifeYears: asset?.usefulLifeYears || 5,
      depreciationMethod: asset?.depreciationMethod || "straight-line",
      decliningBalanceRate: asset?.decliningBalanceRate || undefined,
      status: asset?.status || "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("/api/fixed-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Fixed asset created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating fixed asset",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest(`/api/fixed-assets/${asset?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Fixed asset updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fixed-assets", asset?.id] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating fixed asset",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (asset) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const calculatePreview = () => {
    const values = form.getValues();
    if (!values.acquisitionCost || !values.salvageValue || !values.usefulLifeYears) {
      toast({
        title: "Missing information",
        description: "Please fill in acquisition cost, salvage value, and useful life",
        variant: "destructive",
      });
      return;
    }

    // Simple preview calculation
    const cost = parseFloat(values.acquisitionCost);
    const salvage = parseFloat(values.salvageValue);
    const years = values.usefulLifeYears;
    const depreciableAmount = cost - salvage;

    const schedule = [];
    let bookValue = cost;

    for (let year = 1; year <= years; year++) {
      let depreciation = 0;

      if (values.depreciationMethod === "straight-line") {
        depreciation = depreciableAmount / years;
      } else if (values.depreciationMethod === "declining-balance") {
        const rate = (values.decliningBalanceRate || 20) / 100;
        depreciation = Math.min(bookValue * rate, bookValue - salvage);
      }

      bookValue = Math.max(bookValue - depreciation, salvage);

      schedule.push({
        year,
        depreciation: depreciation.toFixed(2),
        bookValue: bookValue.toFixed(2),
      });

      if (bookValue <= salvage) break;
    }

    setPreviewSchedule(schedule);
    setShowPreview(true);
  };

  const depreciationMethod = form.watch("depreciationMethod");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{asset ? "Edit Fixed Asset" : "Create Fixed Asset"}</CardTitle>
        <CardDescription>
          Manage fixed assets and configure depreciation settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Office Equipment" {...field} data-testid="input-asset-name" />
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
                      <Input placeholder="e.g., Machinery, Vehicles" {...field} data-testid="input-asset-category" />
                    </FormControl>
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
                      placeholder="Provide additional details about the asset"
                      {...field}
                      data-testid="input-asset-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="acquisitionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquisition Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-acquisition-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acquisitionCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquisition Cost</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        {...field} 
                        data-testid="input-acquisition-cost"
                      />
                    </FormControl>
                    <FormDescription>Original purchase price of the asset</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                    <FormDescription>Expected value at end of life</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usefulLifeYears"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Useful Life (Years)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-useful-life"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="depreciationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Depreciation Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-depreciation-method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="straight-line">Straight Line</SelectItem>
                        <SelectItem value="declining-balance">Declining Balance</SelectItem>
                        <SelectItem value="none">No Depreciation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {depreciationMethod === "declining-balance" && (
              <FormField
                control={form.control}
                name="decliningBalanceRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Declining Balance Rate (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        max="100"
                        step="1"
                        placeholder="20"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-declining-rate"
                      />
                    </FormControl>
                    <FormDescription>Annual depreciation rate as percentage</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {showPreview && previewSchedule.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Depreciation Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {previewSchedule.map((item) => (
                      <div key={item.year} className="flex justify-between text-sm">
                        <span>Year {item.year}</span>
                        <span>Depreciation: ${item.depreciation}</span>
                        <span>Book Value: ${item.bookValue}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={calculatePreview}
                data-testid="button-preview-schedule"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Preview Schedule
              </Button>
              
              <div className="flex gap-2">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {asset ? "Update Asset" : "Create Asset"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}