import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import type { Customer, Vendor } from "@shared/schema";

const formSchema = z.object({
  entityType: z.enum(["customer", "vendor"], {
    required_error: "Please select an entity type",
  }),
  entityId: z.string().min(1, "Please select an entity"),
  provider: z.literal("lean"), // Currently only Lean is supported
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectBankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectBankDialog({ open, onOpenChange }: ConnectBankDialogProps) {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entityType: "customer",
      provider: "lean",
    },
  });

  const entityType = form.watch("entityType");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open && entityType === "customer",
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id && open && entityType === "vendor",
  });

  const connectMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      
      const response = await fetch(
        `/api/open-banking/lean/authorize?entityType=${data.entityType}&entityId=${data.entityId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate authorization URL");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsRedirecting(true);
      // Redirect to Lean authorization URL
      window.location.href = data.authorizationUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to connect bank",
        description: error.message,
        variant: "destructive",
      });
      setIsRedirecting(false);
    },
  });

  const onSubmit = (data: FormValues) => {
    connectMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isRedirecting && !connectMutation.isPending) {
      if (!newOpen) {
        form.reset();
      }
      onOpenChange(newOpen);
    }
  };

  const entities = entityType === "customer" ? customers : vendors;
  const hasNoEntities = entities.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-connect-bank">
        <DialogHeader>
          <DialogTitle>Connect Bank Account</DialogTitle>
          <DialogDescription>
            Select which customer or vendor this bank account belongs to, then authorize access through Lean.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="entityType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Type</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("entityId", ""); // Reset entity selection when type changes
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-entity-type">
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {entityType === "customer" ? "Customer" : "Vendor"}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={hasNoEntities}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-entity">
                        <SelectValue 
                          placeholder={
                            hasNoEntities 
                              ? `No ${entityType}s available. Create one first.`
                              : `Select ${entityType}`
                          } 
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>
                          {entity.name}
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
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select value={field.value} disabled>
                    <FormControl>
                      <SelectTrigger data-testid="select-provider">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lean">Lean (Open Banking)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isRedirecting || connectMutation.isPending}
                data-testid="button-cancel-connect"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRedirecting || connectMutation.isPending || hasNoEntities}
                data-testid="button-submit-connect"
              >
                {isRedirecting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Redirecting...
                  </>
                ) : connectMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
