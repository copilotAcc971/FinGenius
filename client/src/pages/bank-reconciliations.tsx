import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { BankReconciliation, Account } from "@shared/schema";
import { BankReconciliationDialog } from "@/components/bank-reconciliation-dialog";

export default function BankReconciliations() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingReconciliation, setEditingReconciliation] = useState<BankReconciliation | null>(null);
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

  const { data: reconciliations = [], isLoading } = useQuery<BankReconciliation[]>({
    queryKey: ["/api/bank-reconciliations", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/bank-reconciliations/${id}?tenantId=${currentTenant.id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-reconciliations", { tenantId: currentTenant?.id }] });
      toast({
        title: "Bank reconciliation deleted",
        description: "Bank reconciliation has been removed successfully.",
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
        description: "Failed to delete bank reconciliation.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      in_progress: "outline",
      completed: "default",
      archived: "secondary",
    };
    
    const labels: Record<string, string> = {
      in_progress: "In Progress",
      completed: "Completed",
      archived: "Archived",
    };
    
    return <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>{labels[status] || status}</Badge>;
  };

  const getDifferenceDisplay = (difference: string | number) => {
    const diff = typeof difference === 'string' ? parseFloat(difference) : difference;
    const isZero = Math.abs(diff) < 0.01;
    
    return (
      <span className={isZero ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} data-testid={`text-difference-${isZero ? 'zero' : 'non-zero'}`}>
        {formatCurrency(diff)}
      </span>
    );
  };

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">No Workspace Selected</h2>
          <p className="text-muted-foreground">Please select or create a workspace to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Bank Reconciliations</h1>
          <p className="text-muted-foreground">Reconcile your bank accounts with journal entries</p>
        </div>
        <Button
          onClick={() => {
            setEditingReconciliation(null);
            setShowDialog(true);
          }}
          data-testid="button-create-reconciliation"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Reconciliation
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : reconciliations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No bank reconciliations found</p>
          <p className="text-sm text-muted-foreground mb-4">
            Get started by creating your first bank reconciliation
          </p>
          <Button
            onClick={() => {
              setEditingReconciliation(null);
              setShowDialog(true);
            }}
            data-testid="button-add-first-reconciliation"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Reconciliation
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank Account</TableHead>
                <TableHead>Reconciliation Date</TableHead>
                <TableHead>Statement Date</TableHead>
                <TableHead className="text-right">Statement Balance</TableHead>
                <TableHead className="text-right">Book Balance</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations.map((reconciliation) => (
                <TableRow key={reconciliation.id} data-testid={`row-reconciliation-${reconciliation.id}`}>
                  <TableCell className="font-medium" data-testid={`text-account-${reconciliation.id}`}>
                    {getAccountName(reconciliation.accountId)}
                  </TableCell>
                  <TableCell data-testid={`text-reconciliation-date-${reconciliation.id}`}>
                    {formatDate(reconciliation.reconciliationDate)}
                  </TableCell>
                  <TableCell data-testid={`text-statement-date-${reconciliation.id}`}>
                    {formatDate(reconciliation.statementDate)}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-statement-balance-${reconciliation.id}`}>
                    {formatCurrency(reconciliation.statementBalance)}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-book-balance-${reconciliation.id}`}>
                    {formatCurrency(reconciliation.bookBalance)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {getDifferenceDisplay(reconciliation.difference)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(reconciliation.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${reconciliation.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingReconciliation(reconciliation);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-${reconciliation.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(reconciliation.id)}
                          className="text-red-600"
                          data-testid={`button-delete-${reconciliation.id}`}
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

      <BankReconciliationDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        reconciliation={editingReconciliation}
      />
    </div>
  );
}
