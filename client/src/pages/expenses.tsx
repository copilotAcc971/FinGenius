import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Expense } from "@shared/schema";

export default function Expenses() {
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

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      approved: "secondary",
      paid: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
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
          <h1 className="text-3xl font-semibold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage business expenses</p>
        </div>
        <Button data-testid="button-add-expense">
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No expenses yet</p>
          <p className="text-sm text-muted-foreground mb-4">Add your first expense or upload a receipt for AI extraction</p>
          <Button data-testid="button-add-first-expense">
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} className="cursor-pointer hover-elevate" data-testid={`row-expense-${expense.id}`}>
                  <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{expense.category}</TableCell>
                  <TableCell className="max-w-xs truncate">{expense.description || "-"}</TableCell>
                  <TableCell>{expense.vendorId || "-"}</TableCell>
                  <TableCell className="text-right font-mono">${parseFloat(expense.amount).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(expense.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
