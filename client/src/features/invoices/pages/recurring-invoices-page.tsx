import { useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Play, Pause, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { type RecurringInvoice, type Currency } from "@shared/schema";
import { RecurringInvoiceDialog } from "@/features/invoices/components/recurring-invoice-dialog";
import { useState } from "react";
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

export default function RecurringInvoicesPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recurringToDelete, setRecurringToDelete] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: recurringInvoices, isLoading } = useQuery<RecurringInvoice[]>({
    queryKey: ["/api/recurring-invoices", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['/api/currencies', { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const handleCreate = () => {
    setSelectedRecurring(null);
    setDialogOpen(true);
  };

  const handleEdit = (recurring: RecurringInvoice) => {
    setSelectedRecurring(recurring);
    setDialogOpen(true);
  };

  const handleDeleteClick = (recurringId: string) => {
    setRecurringToDelete(recurringId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!recurringToDelete || !currentTenant?.id) return;

    try {
      await apiRequest(`/api/recurring-invoices/${recurringToDelete}?tenantId=${currentTenant.id}`, "DELETE", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices", { tenantId: currentTenant.id }] });
      toast({ title: "Recurring invoice deleted successfully" });
    } catch (error: any) {
      toast({ 
        title: "Error deleting recurring invoice", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setDeleteDialogOpen(false);
      setRecurringToDelete(null);
    }
  };

  const handleGenerateNow = async (recurringId: string) => {
    if (!currentTenant?.id) return;

    setGeneratingId(recurringId);
    try {
      await apiRequest(`/api/recurring-invoices/${recurringId}/generate?tenantId=${currentTenant.id}`, "POST", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices", { tenantId: currentTenant.id }] });
      await queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant.id }] });
      
      toast({ 
        title: "Invoice generated successfully", 
        description: "New invoice created from recurring template" 
      });
    } catch (error: any) {
      toast({ 
        title: "Error generating invoice", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleToggleStatus = async (recurring: RecurringInvoice) => {
    if (!currentTenant?.id) return;

    const newStatus = recurring.status === 'active' ? 'paused' : 'active';
    setTogglingId(recurring.id);
    
    try {
      await apiRequest(
        `/api/recurring-invoices/${recurring.id}?tenantId=${currentTenant.id}`, 
        "PATCH", 
        { status: newStatus }
      );

      await queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices", { tenantId: currentTenant.id }] });
      
      toast({ 
        title: `Recurring invoice ${newStatus === 'active' ? 'resumed' : 'paused'}`, 
      });
    } catch (error: any) {
      toast({ 
        title: "Error updating status", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setTogglingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className?: string }> = {
      active: { variant: "default" },
      paused: { variant: "secondary" },
      completed: { variant: "outline" },
    };
    const config = variants[status] || { variant: "default" };
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{status}</Badge>;
  };

  const getFrequencyBadge = (frequency: string) => {
    return <Badge variant="outline" data-testid={`badge-frequency-${frequency}`}>{frequency}</Badge>;
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
          <h1 className="text-3xl font-semibold">Recurring Invoices</h1>
          <p className="text-muted-foreground">Manage your recurring invoice templates</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-recurring-invoice">
          <Plus className="w-4 h-4 mr-2" />
          New Recurring Invoice
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : recurringInvoices && recurringInvoices.length > 0 ? (
        <div className="grid gap-4">
          {recurringInvoices.map((recurring) => (
            <Card key={recurring.id} data-testid={`card-recurring-invoice-${recurring.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`text-recurring-number-${recurring.id}`}>
                      {recurring.recurringInvoiceNumber || recurring.id}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Starts: {new Date(recurring.startDate).toLocaleDateString()}
                      {recurring.endDate && ` - Ends: ${new Date(recurring.endDate).toLocaleDateString()}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Next Invoice: {new Date(recurring.nextInvoiceDate).toLocaleDateString()}
                    </p>
                    {recurring.invoiceSubject && (
                      <p className="text-sm mt-1">{recurring.invoiceSubject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {getFrequencyBadge(recurring.frequency)}
                    {getStatusBadge(recurring.status)}
                    <span className="text-lg font-semibold" data-testid={`text-recurring-total-${recurring.id}`}>
                      {formatCurrency(parseFloat(recurring.total), recurring.currency, currencies)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(recurring)}
                    data-testid={`button-edit-recurring-${recurring.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  {recurring.status === 'active' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleGenerateNow(recurring.id)}
                      disabled={generatingId === recurring.id}
                      data-testid={`button-generate-recurring-${recurring.id}`}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {generatingId === recurring.id ? "Generating..." : "Generate Now"}
                    </Button>
                  )}
                  {recurring.status !== 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleToggleStatus(recurring)}
                      disabled={togglingId === recurring.id}
                      data-testid={`button-toggle-status-${recurring.id}`}
                    >
                      {recurring.status === 'active' ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Resume
                        </>
                      )}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(recurring.id)}
                    data-testid={`button-delete-recurring-${recurring.id}`}
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
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recurring invoices yet</h3>
            <p className="text-muted-foreground mb-4">Create your first recurring invoice template to get started</p>
            <Button onClick={handleCreate} data-testid="button-create-first-recurring-invoice">
              <Plus className="w-4 h-4 mr-2" />
              Create Recurring Invoice
            </Button>
          </CardContent>
        </Card>
      )}

      <RecurringInvoiceDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        recurringInvoice={selectedRecurring}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the recurring invoice template.
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
