import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Percent } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
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
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import type { Tax } from "@shared/schema";
import { TaxDialog } from "@/features/taxes/components/tax-dialog";

export default function Taxes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
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

  const { data: taxes = [], isLoading } = useQuery<Tax[]>({
    queryKey: ["/api/taxes", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/taxes/${id}?tenantId=${currentTenant.id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxes", { tenantId: currentTenant?.id }] });
      toast({
        title: "Tax deleted",
        description: "Tax has been removed successfully.",
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
        description: "Failed to delete tax.",
        variant: "destructive",
      });
    },
  });

  const filteredTaxes = taxes.filter((tax) =>
    tax.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatRate = (rate: string) => {
    return `${parseFloat(rate).toFixed(2)}%`;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Taxes</h1>
          <p className="text-muted-foreground">Manage tax rates for your business</p>
        </div>
        <Button
          onClick={() => {
            setEditingTax(null);
            setShowDialog(true);
          }}
          data-testid="button-add-tax"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Tax
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search taxes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-taxes"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filteredTaxes.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No taxes found"
          description={searchTerm ? "Try adjusting your search" : "Get started by adding your first tax rate"}
          action={!searchTerm ? {
            label: "Add Tax",
            onClick: () => {
              setEditingTax(null);
              setShowDialog(true);
            }
          } : undefined}
          dataTestId="empty-state-taxes"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTaxes.map((tax) => (
                <TableRow key={tax.id} data-testid={`row-tax-${tax.id}`}>
                  <TableCell className="font-medium">{tax.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatRate(tax.rate)}</TableCell>
                  <TableCell>
                    {tax.isDefault ? (
                      <Badge variant="default">Default</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tax.isActive ? "default" : "secondary"}>
                      {tax.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          data-testid={`button-actions-${tax.id}`}
                          aria-label={`Actions for tax ${tax.name}`}
                          title="More options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingTax(tax);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-${tax.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(tax.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${tax.id}`}
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

      <TaxDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setEditingTax(null);
        }}
        tax={editingTax}
      />
    </div>
  );
}
