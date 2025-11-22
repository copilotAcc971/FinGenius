import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { expenseColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";
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
          <h1 className="text-3xl font-semibold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage business expenses</p>
        </div>
        <Button data-testid="button-add-expense">
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6"><div className="space-y-4">{Array.from({length: 8}).map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse"></div>)}</div></div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Add your first expense or upload a receipt for AI extraction"
          action={{
            label: "Add Expense",
            onClick: () => {}
          }}
          data_testid="empty-state-expenses"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(expenseColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(expenseColumns[0])}>Date</TableHead>
                <TableHead className={getColumnClassName(expenseColumns[1])}>Category</TableHead>
                <TableHead className={getColumnClassName(expenseColumns[2])}>Description</TableHead>
                <TableHead className={getColumnClassName(expenseColumns[3])}>Vendor</TableHead>
                <TableHead className={getColumnClassName(expenseColumns[4])}>Amount</TableHead>
                <TableHead className={getColumnClassName(expenseColumns[5])}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} className="cursor-pointer hover-elevate" data-testid={`row-expense-${expense.id}`}>
                  <TableCell className={getColumnClassName(expenseColumns[0])}>{new Date(expense.date).toLocaleDateString()}</TableCell>
                  <TableCell className={`${getColumnClassName(expenseColumns[1])} font-medium`}>{expense.category}</TableCell>
                  <TableCell className={`${getColumnClassName(expenseColumns[2])} max-w-xs truncate`}>{expense.description || "-"}</TableCell>
                  <TableCell className={getColumnClassName(expenseColumns[3])}>{expense.vendorId || "-"}</TableCell>
                  <TableCell className={`${getColumnClassName(expenseColumns[4])} font-mono`}>${parseFloat(expense.amount).toFixed(2)}</TableCell>
                  <TableCell className={getColumnClassName(expenseColumns[5])}>{getStatusBadge(expense.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
