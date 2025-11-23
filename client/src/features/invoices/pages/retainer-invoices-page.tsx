import { Suspense, lazy, useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { type RetainerInvoice, type Currency } from "@shared/schema";
import { useState } from "react";

const RetainerInvoiceDialog = lazy(() => import("@/features/invoices/components/retainer-invoice-dialog").then(m => ({ default: m.RetainerInvoiceDialog })));
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
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

export default function RetainerInvoicesPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRetainer, setSelectedRetainer] = useState<RetainerInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [retainerToDelete, setRetainerToDelete] = useState<string | null>(null);

  const { data: retainerInvoices, isLoading } = useQuery<RetainerInvoice[]>({
    queryKey: ["/api/retainer-invoices", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/currencies', { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const handleCreate = () => {
    setSelectedRetainer(null);
    setDialogOpen(true);
  };

  const handleEdit = (retainer: RetainerInvoice) => {
    setSelectedRetainer(retainer);
    setDialogOpen(true);
  };

  const handleDeleteClick = (retainerId: string) => {
    setRetainerToDelete(retainerId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!retainerToDelete || !currentTenant?.id) return;

    try {
      await apiRequest(`/api/retainer-invoices/${retainerToDelete}?tenantId=${currentTenant.id}`, "DELETE", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/retainer-invoices", { tenantId: currentTenant.id }] });
      toast({ title: "Retainer invoice deleted successfully" });
    } catch (error: any) {
      toast({ 
        title: "Error deleting retainer invoice", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setDeleteDialogOpen(false);
      setRetainerToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { variant: "secondary" },
      sent: { variant: "outline" },
      paid: { variant: "default" },
      partially_applied: { variant: "default" },
      fully_applied: { variant: "outline" },
    };
    const config = variants[status] || { variant: "default" };
    const displayStatus = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{displayStatus}</Badge>;
  };

  const calculateTotals = () => {
    if (!retainerInvoices) return { totalAmount: 0, totalRemaining: 0 };
    
    return retainerInvoices.reduce((acc, retainer) => ({
      totalAmount: acc.totalAmount + parseFloat(retainer.total),
      totalRemaining: acc.totalRemaining + parseFloat(retainer.remainingBalance),
    }), { totalAmount: 0, totalRemaining: 0 });
  };

  const totals = calculateTotals();

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
          <h1 className="text-3xl font-semibold">Retainer Invoices</h1>
          <p className="text-muted-foreground">Manage advance payment invoices and track balances</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-retainer-invoice">
          <Plus className="w-4 h-4 mr-2" />
          New Retainer Invoice
        </Button>
      </div>

      {!isLoading && retainerInvoices && retainerInvoices.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Retainers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-retainers">
                {retainerInvoices && retainerInvoices.length > 0 ? formatCurrency(totals.totalAmount, retainerInvoices[0].currency, currencies) : '$0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                {retainerInvoices.length} retainer invoice{retainerInvoices.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Remaining Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-remaining">
                {retainerInvoices && retainerInvoices.length > 0 ? formatCurrency(totals.totalRemaining, retainerInvoices[0].currency, currencies) : '$0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Available for future invoices
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : retainerInvoices && retainerInvoices.length > 0 ? (
        <div className="grid gap-4">
          {retainerInvoices.map((retainer) => (
            <Card key={retainer.id} data-testid={`card-retainer-invoice-${retainer.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`text-retainer-number-${retainer.id}`}>
                      {retainer.retainerNumber || retainer.id}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Date: {new Date(retainer.invoiceDate).toLocaleDateString()}
                    </p>
                    {retainer.invoiceSubject && (
                      <p className="text-sm mt-1">{retainer.invoiceSubject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {getStatusBadge(retainer.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-semibold" data-testid={`text-retainer-total-${retainer.id}`}>
                      {formatCurrency(parseFloat(retainer.total), retainer.currency, currencies)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Used</p>
                    <p className="text-lg font-semibold" data-testid={`text-retainer-used-${retainer.id}`}>
                      {formatCurrency(parseFloat(retainer.amountUsed), retainer.currency, currencies)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining Balance</p>
                    <p className="text-lg font-semibold" data-testid={`text-retainer-remaining-${retainer.id}`}>
                      {formatCurrency(parseFloat(retainer.remainingBalance), retainer.currency, currencies)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(retainer)}
                    data-testid={`button-edit-retainer-${retainer.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(retainer.id)}
                    data-testid={`button-delete-retainer-${retainer.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-lg font-medium mb-2">No retainer invoices yet</p>
            <p className="text-muted-foreground mb-4">Create your first retainer invoice to get started</p>
            <Button onClick={handleCreate} data-testid="button-create-first-retainer-invoice">
              <Plus className="w-4 h-4 mr-2" />
              New Retainer Invoice
            </Button>
          </CardContent>
        </Card>
      )}

      {dialogOpen && (
        <Suspense fallback={null}>
          <RetainerInvoiceDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            retainerInvoice={selectedRetainer}
          />
        </Suspense>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the retainer invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
