import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Edit, Trash2, Mail, Download, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useOptimisticUpdate } from "@/shared/hooks/optimistic-ui/useOptimisticUpdate";
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
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/shared/hooks/useAuth";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { isUnauthorizedError } from "@/shared/lib/auth/authUtils";
import type { Invoice, InvoiceWithOptimistic, Customer, Currency } from "@shared/schema";
import { InvoiceDialog } from "@/features/invoices/components/invoice-dialog";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
import { invoiceColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";
import { useOptimisticCreate } from "@/shared/hooks/optimistic-ui/useOptimisticCreate";
import { PendingBadge } from "@/shared/components/ui/pending-badge";
import { cn } from "@/shared/lib/utils/utils";

export default function Invoices() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
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

  const { data: invoices = [], isLoading } = useQuery<InvoiceWithOptimistic[]>({
    queryKey: ["/api/invoices", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : customerId;
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      const res = await apiRequest(
        `/api/invoices/${invoiceId}/send-email?tenantId=${currentTenant.id}`,
        "POST",
        {}
      );
      
      // Parse JSON once
      const data = await res.json().catch(() => ({ error: 'Failed to send email' }));
      
      // Check if response was not ok
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant?.id }] });
      toast({
        title: "Invoice sent successfully",
        description: "The invoice has been emailed to the customer.",
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
        title: "Failed to send invoice",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/invoices/${id}?tenantId=${currentTenant.id}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant?.id }] });
      toast({
        title: "Invoice deleted",
        description: "Invoice has been removed successfully.",
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
        description: "Failed to delete invoice.",
        variant: "destructive",
      });
    },
  });

  // Optimistic update for marking invoice as paid
  const markAsPaidMutation = useOptimisticUpdate<InvoiceWithOptimistic[]>({
    endpoint: '/api/invoices',
    queryKey: ['/api/invoices', { tenantId: currentTenant?.id }],
    idKey: 'id',
    successMessage: 'Invoice marked as paid',
    errorMessage: 'Failed to mark invoice as paid',
  });

  const handleSendEmail = (invoiceId: string) => {
    sendEmailMutation.mutate(invoiceId);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "outline",
      paid: "default",
      overdue: "destructive",
      cancelled: "secondary",
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
          <h1 className="text-3xl font-semibold">Invoices</h1>
          <p className="text-muted-foreground">Manage your sales invoices</p>
        </div>
        <Button
          onClick={() => {
            setEditingInvoice(null);
            setShowDialog(true);
          }}
          data-testid="button-create-invoice"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={invoiceColumns} minHeight="600px" />
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No invoices yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first invoice to get started</p>
          <Button
            onClick={() => {
              setEditingInvoice(null);
              setShowDialog(true);
            }}
            data-testid="button-create-first-invoice"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(invoiceColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(invoiceColumns[0])}>Invoice #</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[1])}>Customer</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[2])}>Date</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[3])}>Due Date</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[4])}>Amount</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[5])}>Status</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[6])}>Email Status</TableHead>
                <TableHead className={getColumnClassName(invoiceColumns[7])}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow 
                  key={invoice.id} 
                  className={cn(
                    "hover-elevate",
                    invoice.isPending && "opacity-60"
                  )}
                  data-testid={`row-invoice-${invoice.id}`}
                >
                  <TableCell className={`${getColumnClassName(invoiceColumns[0])} font-medium font-mono`}>{invoice.invoiceNumber}</TableCell>
                  <TableCell className={getColumnClassName(invoiceColumns[1])}>{getCustomerName(invoice.customerId)}</TableCell>
                  <TableCell className={getColumnClassName(invoiceColumns[2])}>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell className={getColumnClassName(invoiceColumns[3])}>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className={`${getColumnClassName(invoiceColumns[4])} font-mono`} data-testid={`text-amount-${invoice.id}`}>
                    {currenciesLoading ? '...' : formatCurrency(parseFloat(invoice.total), invoice.currencyCode, currencies)}
                  </TableCell>
                  <TableCell className={getColumnClassName(invoiceColumns[5])}>
                    <div className="flex items-center gap-2">
                      {invoice.isPending ? (
                        <PendingBadge isPending={true} />
                      ) : (
                        getStatusBadge(invoice.status)
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={getColumnClassName(invoiceColumns[6])}>
                    {!invoice.emailStatus || invoice.emailStatus === 'pending' ? (
                      <Badge variant="outline" data-testid={`badge-email-status-not-sent-${invoice.id}`}>Not Sent</Badge>
                    ) : invoice.emailStatus === 'sent' ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="default" data-testid={`badge-email-status-sent-${invoice.id}`}>Sent</Badge>
                        {invoice.emailSentAt && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-email-sent-date-${invoice.id}`}>
                            {new Date(invoice.emailSentAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : invoice.emailStatus === 'failed' ? (
                      <Badge variant="destructive" data-testid={`badge-email-status-failed-${invoice.id}`}>Failed</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className={getColumnClassName(invoiceColumns[7])}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          disabled={invoice.isPending}
                          data-testid={`button-actions-${invoice.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setShowDialog(true);
                          }}
                          disabled={invoice.isPending}
                          data-testid={`button-edit-${invoice.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSendEmail(invoice.id)}
                          disabled={sendEmailMutation.isPending || invoice.isPending}
                          data-testid={`button-send-email-${invoice.id}`}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <DropdownMenuItem
                            onClick={() => {
                              markAsPaidMutation.mutate({
                                id: invoice.id,
                                data: { 
                                  status: 'paid',
                                  amountPaid: invoice.total,
                                }
                              });
                            }}
                            disabled={markAsPaidMutation.isPending || invoice.isPending}
                            data-testid={`button-mark-paid-${invoice.id}`}
                          >
                            {markAsPaidMutation.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            if (!currentTenant?.id) {
                              toast({ title: "Error", description: "Tenant not loaded", variant: "destructive" });
                              return;
                            }
                            window.open(`/api/invoices/${invoice.id}/pdf?tenantId=${currentTenant.id}`, '_blank');
                          }}
                          disabled={!currentTenant?.id || invoice.isPending}
                          data-testid={`button-download-pdf-${invoice.id}`}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(invoice.id)}
                          className="text-destructive"
                          disabled={invoice.isPending}
                          data-testid={`button-delete-${invoice.id}`}
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

      <InvoiceDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) setEditingInvoice(null);
        }}
        invoice={editingInvoice}
      />
    </div>
  );
}
