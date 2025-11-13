import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No payments yet</p>
          <p className="text-sm text-muted-foreground mb-4">Payments will appear here when you pay bills or expenses</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell>{new Date(payment.createdAt!).toLocaleDateString()}</TableCell>
                  <TableCell>{payment.vendorId}</TableCell>
                  <TableCell>{payment.billId ? "Bill" : payment.expenseId ? "Expense" : "-"}</TableCell>
                  <TableCell className="text-right font-mono">${parseFloat(payment.amount).toFixed(2)}</TableCell>
                  <TableCell>{payment.scheduledDate ? new Date(payment.scheduledDate).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>
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
