import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { insertVendorSchema, type Vendor } from "@shared/schema";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useTenant } from "@/hooks/useTenant";

const formSchema = insertVendorSchema;

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor | null;
}

export function VendorDialog({ open, onOpenChange, vendor }: VendorDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantId: currentTenant?.id || "",
      name: "",
      email: "",
      phone: "",
      company: "",
      address: "",
      stripeAccountId: "",
      bankAccountLast4: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (vendor) {
      form.reset({
        tenantId: vendor.tenantId,
        name: vendor.name,
        email: vendor.email || "",
        phone: vendor.phone || "",
        company: vendor.company || "",
        address: vendor.address || "",
        stripeAccountId: vendor.stripeAccountId || "",
        bankAccountLast4: vendor.bankAccountLast4 || "",
        notes: vendor.notes || "",
      });
    } else {
      form.reset({
        tenantId: currentTenant?.id || "",
        name: "",
        email: "",
        phone: "",
        company: "",
        address: "",
        stripeAccountId: "",
        bankAccountLast4: "",
        notes: "",
      });
    }
  }, [vendor, currentTenant, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (vendor) {
        return await apiRequest("PATCH", `/api/vendors/${vendor.id}`, values);
      }
      return await apiRequest("POST", "/api/vendors", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: vendor ? "Vendor updated" : "Vendor created",
        description: `Vendor has been ${vendor ? "updated" : "created"} successfully.`,
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
        description: `Failed to ${vendor ? "update" : "create"} vendor.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="dialog-vendor">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          <DialogDescription>
            {vendor ? "Update vendor information" : "Add a new vendor to your workspace"}
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
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} data-testid="input-company" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="vendor@example.com" {...field} data-testid="input-email" />
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="123 Main St, City, State ZIP" {...field} data-testid="input-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stripeAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stripe Account ID</FormLabel>
                    <FormControl>
                      <Input placeholder="acct_..." {...field} data-testid="input-stripe-account-id" />
                    </FormControl>
                    <FormDescription className="text-xs">
                      For Stripe Connect payments
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bankAccountLast4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Account Last 4</FormLabel>
                    <FormControl>
                      <Input placeholder="1234" maxLength={4} {...field} data-testid="input-bank-last4" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} data-testid="input-notes" />
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
                {saveMutation.isPending ? "Saving..." : (vendor ? "Update" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
