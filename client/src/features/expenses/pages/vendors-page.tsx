import { Suspense, lazy, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Building2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { PendingBadge } from "@/shared/components/ui/pending-badge";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { vendorColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";
import type { Vendor, VendorWithOptimistic } from "@shared/schema";

const VendorDialog = lazy(() => import("@/features/vendors/components/vendor-dialog").then(m => ({ default: m.VendorDialog })));

export default function Vendors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: vendors = [], isLoading } = useQuery<VendorWithOptimistic[]>({
    queryKey: ["/api/vendors", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/vendors/${id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({
        title: "Vendor deleted",
        description: "Vendor has been removed successfully.",
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
        title: "Error",
        description: "Failed to delete vendor.",
        variant: "destructive",
      });
    },
  });

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Vendors</h1>
          <p className="text-muted-foreground">Manage your vendor contacts and payment details</p>
        </div>
        <Button
          onClick={() => {
            setEditingVendor(null);
            setShowDialog(true);
          }}
          data-testid="button-add-vendor"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-vendors"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={vendorColumns} minHeight="600px" />
      ) : filteredVendors.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={searchTerm ? "No vendors match your search" : "No vendors yet"}
          description={searchTerm ? "Try adjusting your search terms" : "Get started by creating your first vendor"}
          action={!searchTerm ? {
            label: "Add Vendor",
            onClick: () => {
              setEditingVendor(null);
              setShowDialog(true);
            }
          } : undefined}
          dataTestId="empty-state-vendors"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(vendorColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(vendorColumns[0])}>Name</TableHead>
                <TableHead className={getColumnClassName(vendorColumns[1])}>Email</TableHead>
                <TableHead className={getColumnClassName(vendorColumns[2])}>Phone</TableHead>
                <TableHead className={getColumnClassName(vendorColumns[3])}>Company</TableHead>
                <TableHead className={getColumnClassName(vendorColumns[4])}>Payment Status</TableHead>
                <TableHead className={getColumnClassName(vendorColumns[5])}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.map((vendor) => (
                <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`} className={vendor.isPending ? "opacity-60" : ""}>
                  <TableCell className={`${getColumnClassName(vendorColumns[0])} font-medium`}>{vendor.name}</TableCell>
                  <TableCell className={getColumnClassName(vendorColumns[1])}>{vendor.email || "-"}</TableCell>
                  <TableCell className={getColumnClassName(vendorColumns[2])}>{vendor.phone || "-"}</TableCell>
                  <TableCell className={getColumnClassName(vendorColumns[3])}>{vendor.company || "-"}</TableCell>
                  <TableCell className={getColumnClassName(vendorColumns[4])}>
                    {vendor.isPending ? (
                      <PendingBadge />
                    ) : vendor.stripeAccountId ? (
                      <Badge variant="default" data-testid={`badge-connected-${vendor.id}`}>Connected</Badge>
                    ) : (
                      <Badge variant="secondary" data-testid={`badge-not-connected-${vendor.id}`}>Not Connected</Badge>
                    )}
                  </TableCell>
                  <TableCell className={getColumnClassName(vendorColumns[5])}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          data-testid={`button-actions-${vendor.id}`} 
                          disabled={vendor.isPending}
                          aria-label={`Actions for vendor ${vendor.name}`}
                          title="More options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingVendor(vendor as Vendor);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-${vendor.id}`}
                          disabled={vendor.isPending}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(vendor.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${vendor.id}`}
                          disabled={vendor.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showDialog && (
        <Suspense fallback={null}>
          <VendorDialog
            open={showDialog}
            onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) setEditingVendor(null);
            }}
            vendor={editingVendor}
          />
        </Suspense>
      )}
    </div>
  );
}
