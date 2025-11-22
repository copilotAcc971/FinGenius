import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Edit, Trash2, CreditCard } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { PendingBadge } from "@/shared/components/ui/pending-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { TableSkeleton, CardSkeleton } from "@/shared/components/ui/skeleton";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { CustomerPaymentDialog } from "@/features/payments/components/customer-payment-dialog";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
import { customerPaymentColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";
import type { CustomerPaymentWithOptimistic, Customer, Invoice, Currency } from "@shared/schema";

export default function CustomerPayments() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CustomerPaymentWithOptimistic | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<CustomerPaymentWithOptimistic | null>(null);

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

  const { data: payments = [], isLoading } = useQuery<CustomerPaymentWithOptimistic[]>({
    queryKey: ["/api/customer-payments", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/customer-payments/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments", { tenantId: currentTenant?.id }] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant?.id }] });
      toast({
        title: "Payment deleted",
        description: "The payment has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
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
        description: "Failed to delete payment.",
        variant: "destructive",
      });
    },
  });

  const getPaymentMethodBadge = (method: string) => {
    const labels: Record<string, string> = {
      cash: "Cash",
      check: "Check",
      bank_transfer: "Bank Transfer",
      credit_card: "Credit Card",
      other: "Other",
    };
    
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      cash: "default",
      check: "secondary",
      bank_transfer: "outline",
      credit_card: "default",
      other: "secondary",
    };
    
    return (
      <Badge variant={variants[method] || "secondary"} data-testid={`badge-method-${method}`}>
        {labels[method] || method}
      </Badge>
    );
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? (customer.displayName || customer.name) : customerId;
  };

  const getInvoiceNumber = (invoiceId: string | null) => {
    if (!invoiceId) return "-";
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice ? invoice.invoiceNumber : invoiceId;
  };

  const handleEdit = (payment: CustomerPaymentWithOptimistic) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handleDelete = (payment: CustomerPaymentWithOptimistic) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleAddNew = () => {
    setSelectedPayment(null);
    setDialogOpen(true);
  };

  const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

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
          <h1 className="text-3xl font-semibold">Customer Payments</h1>
          <p className="text-muted-foreground">Track payments received from customers</p>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-payment">
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold font-mono" data-testid="text-total-payments">
              ${totalPayments.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {payments.length} payment{payments.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={customerPaymentColumns} minHeight="400px" />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Record your first customer payment"
          action={{
            label: "Record Payment",
            onClick: handleAddNew
          }}
          data_testid="empty-state-customer-payments"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(customerPaymentColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(customerPaymentColumns[0])}>Payment Number</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[1])}>Customer</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[2])}>Invoice</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[3])}>Date</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[4])}>Amount</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[5])}>Payment Method</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[6])}>Reference</TableHead>
                <TableHead className={getColumnClassName(customerPaymentColumns[7])}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow 
                  key={payment.id} 
                  data-testid={`row-payment-${payment.id}`}
                  className={cn(payment.isPending && "opacity-50")}
                >
                  <TableCell className={`${getColumnClassName(customerPaymentColumns[0])} font-medium`} data-testid={`text-payment-number-${payment.id}`}>
                    <div className="flex items-center gap-2">
                      {payment.paymentNumber || "-"}
                      {payment.isPending && <PendingBadge />}
                    </div>
                  </TableCell>
                  <TableCell className={getColumnClassName(customerPaymentColumns[1])} data-testid={`text-customer-${payment.id}`}>
                    {getCustomerName(payment.customerId)}
                  </TableCell>
                  <TableCell className={getColumnClassName(customerPaymentColumns[2])} data-testid={`text-invoice-${payment.id}`}>
                    {getInvoiceNumber(payment.invoiceId)}
                  </TableCell>
                  <TableCell className={getColumnClassName(customerPaymentColumns[3])} data-testid={`text-date-${payment.id}`}>
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className={`${getColumnClassName(customerPaymentColumns[4])} font-mono`} data-testid={`amount-${payment.id}`}>
                    {currenciesLoading 
                      ? '...' 
                      : formatCurrency(parseFloat(payment.amount), payment.currencyCode, currencies)
                    }
                  </TableCell>
                  <TableCell className={getColumnClassName(customerPaymentColumns[5])}>{getPaymentMethodBadge(payment.paymentMethod)}</TableCell>
                  <TableCell className={getColumnClassName(customerPaymentColumns[6])} data-testid={`text-reference-${payment.id}`}>
                    {payment.referenceNumber || "-"}
                  </TableCell>
                  <TableCell className={getColumnClassName(customerPaymentColumns[7])}>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(payment)}
                        disabled={payment.isPending}
                        data-testid={`button-edit-${payment.id}`}
                        aria-label={`Edit payment ${payment.paymentNumber || payment.id}`}
                        title="Edit payment"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(payment)}
                        disabled={payment.isPending}
                        data-testid={`button-delete-${payment.id}`}
                        aria-label={`Delete payment ${payment.paymentNumber || payment.id}`}
                        title="Delete payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={selectedPayment}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-payment">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paymentToDelete && deleteMutation.mutate(paymentToDelete.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
