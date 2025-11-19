import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { TableSkeleton, CardSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { paymentColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";
import type { Payment } from "@shared/schema";

export default function Payments() {
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

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      scheduled: "secondary",
      processing: "outline",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "scheduled");
  const totalPending = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

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
          <h1 className="text-3xl font-semibold">Vendor Payments</h1>
          <p className="text-muted-foreground">Manage payments to vendors via Stripe Connect</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold font-mono" data-testid="text-pending-payments">
              ${totalPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingPayments.length} payment{pendingPayments.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={paymentColumns} minHeight="500px" />
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No payments yet</p>
          <p className="text-sm text-muted-foreground mb-4">Payments will appear here when you pay bills or expenses</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(paymentColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(paymentColumns[0])}>Date</TableHead>
                <TableHead className={getColumnClassName(paymentColumns[1])}>Vendor</TableHead>
                <TableHead className={getColumnClassName(paymentColumns[2])}>Type</TableHead>
                <TableHead className={getColumnClassName(paymentColumns[3])}>Amount</TableHead>
                <TableHead className={getColumnClassName(paymentColumns[4])}>Scheduled For</TableHead>
                <TableHead className={getColumnClassName(paymentColumns[5])}>Status</TableHead>
                <TableHead className={getColumnClassName(paymentColumns[6])}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell className={getColumnClassName(paymentColumns[0])}>{new Date(payment.createdAt!).toLocaleDateString()}</TableCell>
                  <TableCell className={getColumnClassName(paymentColumns[1])}>{payment.vendorId}</TableCell>
                  <TableCell className={getColumnClassName(paymentColumns[2])}>{payment.billId ? "Bill" : payment.expenseId ? "Expense" : "-"}</TableCell>
                  <TableCell className={`${getColumnClassName(paymentColumns[3])} font-mono`}>${parseFloat(payment.amount).toFixed(2)}</TableCell>
                  <TableCell className={getColumnClassName(paymentColumns[4])}>{payment.scheduledDate ? new Date(payment.scheduledDate).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className={getColumnClassName(paymentColumns[5])}>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className={getColumnClassName(paymentColumns[6])}>
                    {payment.status === "pending" && (
                      <Button size="sm" variant="outline" data-testid={`button-pay-${payment.id}`}>
                        Pay Now
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
