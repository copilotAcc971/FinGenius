import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTenant } from "@/shared/contexts/TenantContext";
import { Building2, CheckCircle, AlertCircle, Plus, Users, ShieldCheck } from "lucide-react";
import type { Tenant } from "@shared/schema";
import { apiRequest } from "@/shared/lib/api/queryClient";

interface TenantWithRoles extends Tenant {
  roles: Array<{
    id: string;
    name: string;
  }>;
}

const createTenantSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
});

type CreateTenantFormData = z.infer<typeof createTenantSchema>;

export default function TenantSelect() {
  const [, navigate] = useLocation();
  const { setCurrentTenant } = useTenant();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false);

  // Fetch user's tenants with roles
  const { data: tenants, isLoading, error, refetch } = useQuery<TenantWithRoles[]>({
    queryKey: ["/api/auth/user-tenants"],
    retry: 2,
    staleTime: 0, // Always fetch fresh data on this page
  });

  // Create tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: async (data: CreateTenantFormData) => {
      return await apiRequest("/api/tenants", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Organization created successfully!",
      });
      setShowCreateDialog(false);
      refetch(); // Refresh the tenant list
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create organization",
      });
    },
  });

  // Create tenant form
  const form = useForm<CreateTenantFormData>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: "",
    },
  });

  // Auto-select and redirect if user has exactly one tenant
  useEffect(() => {
    if (tenants && tenants.length === 1 && !isAutoRedirecting) {
      setIsAutoRedirecting(true);
      handleSelectTenant(tenants[0]);
    }
  }, [tenants, isAutoRedirecting]);

  const handleSelectTenant = (tenant: TenantWithRoles) => {
    try {
      // Store tenant in context and localStorage
      setCurrentTenant(tenant);
      
      // Check if there was a return URL stored
      const returnUrl = sessionStorage.getItem("auth-return-url");
      sessionStorage.removeItem("auth-return-url");
      
      // Navigate to dashboard or return URL
      setTimeout(() => {
        navigate(returnUrl || "/");
      }, 100);
      
      toast({
        title: "Welcome back!",
        description: `You're now working in ${tenant.name}`,
      });
    } catch (error) {
      console.error("Error selecting tenant:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to select organization. Please try again.",
      });
    }
  };

  const handleCreateTenant = async (data: CreateTenantFormData) => {
    createTenantMutation.mutate(data);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground">
                <Building2 className="h-5 w-5 text-background" />
              </div>
              <CardTitle className="text-2xl">Loading Organizations...</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Organizations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to load organizations</AlertTitle>
              <AlertDescription>
                {(error as any)?.message || "An error occurred while fetching your organizations."}
              </AlertDescription>
            </Alert>
            <Button onClick={() => refetch()} className="w-full" data-testid="button-retry">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Auto-redirecting state (when user has exactly one tenant)
  if (isAutoRedirecting && tenants && tenants.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Redirecting to {tenants[0].name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You'll be automatically redirected to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No tenants - show create option
  if (!tenants || tenants.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-2xl">Welcome to Copilot Accountant!</CardTitle>
            <CardDescription className="text-base">
              Let's get started by creating your first organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setShowCreateDialog(true)} 
              className="w-full"
              size="lg"
              data-testid="button-create-first-org"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Multiple tenants - show selection
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Select an Organization
          </h1>
          <p className="text-muted-foreground">
            Choose the organization you want to work with
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              className="cursor-pointer hover-elevate transition-all"
              onClick={() => handleSelectTenant(tenant)}
              data-testid={`card-tenant-${tenant.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg">{tenant.name}</h3>
                      {tenant.roles && tenant.roles.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {tenant.roles.map(r => r.name).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {tenant.ownerId && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Owner</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-new-org"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Organization
          </Button>
        </div>
      </div>

      {/* Create Tenant Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Enter a name for your new organization. You can update this later in settings.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateTenant)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Acme Corporation"
                        data-testid="input-org-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTenantMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createTenantMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}