import { useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { type CreditNote, type Currency } from "@shared/schema";
import { CreditNoteDialog } from "@/components/credit-note-dialog";
import { ApplyCreditDialog } from "@/components/apply-credit-dialog";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency-utils";
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

export default function CreditNotesPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [creditNoteToApply, setCreditNoteToApply] = useState<CreditNote | null>(null);

  const { data: creditNotes, isLoading } = useQuery<CreditNote[]>({
    queryKey: ["/api/credit-notes", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const handleCreate = () => {
    setSelectedCreditNote(null);
    setDialogOpen(true);
  };

  const handleEdit = (creditNote: CreditNote) => {
    setSelectedCreditNote(creditNote);
    setDialogOpen(true);
  };

  const handleDeleteClick = (creditNoteId: string) => {
    setCreditNoteToDelete(creditNoteId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!creditNoteToDelete || !currentTenant?.id) return;

    try {
      await apiRequest(`/api/credit-notes/${creditNoteToDelete}?tenantId=${currentTenant.id}`, "DELETE", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/credit-notes", { tenantId: currentTenant.id }] });
      toast({ title: "Credit note deleted successfully" });
    } catch (error: any) {
      toast({ 
        title: "Error deleting credit note", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setDeleteDialogOpen(false);
      setCreditNoteToDelete(null);
    }
  };

  const handleApplyClick = (creditNote: CreditNote) => {
    setCreditNoteToApply(creditNote);
    setApplyDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      issued: "default",
      applied: "outline",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>{status}</Badge>;
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
          <h1 className="text-3xl font-semibold">Credit Notes</h1>
          <p className="text-muted-foreground">Manage customer credit notes</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-credit-note">
          <Plus className="w-4 h-4 mr-2" />
          New Credit Note
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : creditNotes && creditNotes.length > 0 ? (
        <div className="grid gap-4">
          {creditNotes.map((creditNote) => (
            <Card key={creditNote.id} data-testid={`card-credit-note-${creditNote.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-credit-note-number-${creditNote.id}`}>
                      {creditNote.creditNoteNumber || creditNote.id}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(creditNote.creditNoteDate).toLocaleDateString()}
                    </p>
                    {creditNote.reason && (
                      <p className="text-sm mt-1">{creditNote.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(creditNote.status)}
                    <div className="text-right">
                      <div className="text-lg font-semibold" data-testid={`text-credit-note-total-${creditNote.id}`}>
                        {currenciesLoading 
                          ? '...' 
                          : formatCurrency(parseFloat(creditNote.total), creditNote.currencyCode, currencies)
                        }
                      </div>
                      {parseFloat(creditNote.balanceRemaining) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Balance: {currenciesLoading 
                            ? '...' 
                            : formatCurrency(parseFloat(creditNote.balanceRemaining), creditNote.currencyCode, currencies)
                          }
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(creditNote)}
                    data-testid={`button-edit-credit-note-${creditNote.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  {creditNote.status !== 'applied' && parseFloat(creditNote.balanceRemaining) > 0 && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleApplyClick(creditNote)}
                      data-testid={`button-apply-credit-note-${creditNote.id}`}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Apply to Invoice
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(creditNote.id)}
                    data-testid={`button-delete-credit-note-${creditNote.id}`}
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
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No credit notes yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first credit note to get started</p>
          <Button onClick={handleCreate} data-testid="button-create-first-credit-note">
            <Plus className="mr-2 h-4 w-4" />
            Create Credit Note
          </Button>
        </div>
      )}

      <CreditNoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        creditNote={selectedCreditNote}
      />

      <ApplyCreditDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        creditNote={creditNoteToApply}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credit Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this credit note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="button-confirm-delete">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
