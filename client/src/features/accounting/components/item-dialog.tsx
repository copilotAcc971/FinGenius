import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { insertItemSchema, type Item } from "@shared/schema";
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
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { useTenant } from "@/shared/hooks/useTenant";

const formSchema = insertItemSchema;

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}

export function ItemDialog({ open, onOpenChange, item }: ItemDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      rate: "0",
      unit: "",
      type: "goods",
      accountId: "",
      taxId: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || "",
        sku: item.sku || "",
        rate: item.rate,
        unit: item.unit || "",
        type: item.type,
        accountId: item.accountId || "",
        taxId: item.taxId || "",
        isActive: item.isActive ?? true,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        sku: "",
        rate: "0",
        unit: "",
        type: "goods",
        accountId: "",
        taxId: "",
        isActive: true,
      });
    }
  }, [item, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Send tenantId for middleware validation - backend will strip and use verified tenantId
      const payload = {
        tenantId: currentTenant?.id,
        ...values,
      };
      if (item) {
        return await apiRequest(`/api/items/${item.id}`, "PATCH", payload);
      }
      return await apiRequest("/api/items", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", currentTenant?.id] });
      toast({
        title: item ? "Item updated" : "Item created",
        description: `Item has been ${item ? "updated" : "created"} successfully.`,
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
        description: `Failed to ${item ? "update" : "create"} item.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-item">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
          <DialogDescription>
            {item ? "Update item information" : "Add a new product or service to your catalog"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="goods" data-testid="select-option-goods">Goods</SelectItem>
                        <SelectItem value="service" data-testid="select-option-service">Service</SelectItem>
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
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Stock Keeping Unit" {...field} data-testid="input-sku" />
                    </FormControl>
                    <FormDescription>
                      Product identifier for inventory
                    </FormDescription>
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
                    <FormDescription>
                      Measurement unit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate *</FormLabel>
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
                  <FormDescription>
                    Default unit price for this item
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
                      placeholder="Detailed description of the item..."
                      {...field}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
                {saveMutation.isPending ? "Saving..." : (item ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
