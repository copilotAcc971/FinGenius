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
import type { Invoice, Customer } from "@shared/schema";
import { InvoiceDialog } from "@/components/invoice-dialog";

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

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : customerId;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest("DELETE", `/api/invoices/${id}?tenantId=${currentTenant.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
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
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                  <TableCell className="font-medium font-mono">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{getCustomerName(invoice.customerId)}</TableCell>
                  <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono">${parseFloat(invoice.total).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-actions-${invoice.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setShowDialog(true);
                          }}
                          data-testid={`button-edit-${invoice.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(invoice.id)}
                          className="text-destructive"
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
