import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Edit, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { CustomerPaymentDialog } from "@/components/customer-payment-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { CustomerPayment, Customer, Invoice } from "@shared/schema";

export default function CustomerPayments() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CustomerPayment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<CustomerPayment | null>(null);

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

  const { data: payments = [], isLoading } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/customer-payments/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments", currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", currentTenant?.id] });
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

  const handleEdit = (payment: CustomerPayment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handleDelete = (payment: CustomerPayment) => {
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No payments yet</p>
          <p className="text-sm text-muted-foreground mb-4">Record your first customer payment</p>
          <Button onClick={handleAddNew} data-testid="button-add-first-payment">
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                  <TableCell className="font-medium" data-testid={`text-payment-number-${payment.id}`}>
                    {payment.paymentNumber || "-"}
                  </TableCell>
                  <TableCell data-testid={`text-customer-${payment.id}`}>
                    {getCustomerName(payment.customerId)}
                  </TableCell>
                  <TableCell data-testid={`text-invoice-${payment.id}`}>
                    {getInvoiceNumber(payment.invoiceId)}
                  </TableCell>
                  <TableCell data-testid={`text-date-${payment.id}`}>
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-mono" data-testid={`text-amount-${payment.id}`}>
                    ${parseFloat(payment.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>{getPaymentMethodBadge(payment.paymentMethod)}</TableCell>
                  <TableCell data-testid={`text-reference-${payment.id}`}>
                    {payment.referenceNumber || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(payment)}
                        data-testid={`button-edit-${payment.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(payment)}
                        data-testid={`button-delete-${payment.id}`}
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
