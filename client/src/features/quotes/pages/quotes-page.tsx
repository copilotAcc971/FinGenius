import { useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { CardSkeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { useTenant } from "@/shared/hooks/useTenant";
import { type Quote, type Currency } from "@shared/schema";
import { QuoteDialog } from "@/features/quotes/components/quote-dialog";
import { useState } from "react";
import { queryClient, apiRequest } from "@/shared/lib/api/queryClient";
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
import { formatCurrency } from "@/shared/lib/utils/currency-utils";

export default function QuotesPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const handleCreate = () => {
    setSelectedQuote(null);
    setDialogOpen(true);
  };

  const handleEdit = (quote: Quote) => {
    setSelectedQuote(quote);
    setDialogOpen(true);
  };

  const handleDeleteClick = (quoteId: string) => {
    setQuoteToDelete(quoteId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!quoteToDelete || !currentTenant?.id) return;

    try {
      await apiRequest(`/api/quotes/${quoteToDelete}?tenantId=${currentTenant.id}`, "DELETE", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/quotes", { tenantId: currentTenant.id }] });
      toast({ title: "Quote deleted successfully" });
    } catch (error: any) {
      toast({ 
        title: "Error deleting quote", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    if (!currentTenant?.id) return;

    setConvertingQuoteId(quoteId);
    try {
      await apiRequest(`/api/quotes/${quoteId}/convert-to-invoice?tenantId=${currentTenant.id}`, "POST", {});

      await queryClient.invalidateQueries({ queryKey: ["/api/quotes", { tenantId: currentTenant.id }] });
      await queryClient.invalidateQueries({ queryKey: ["/api/invoices", { tenantId: currentTenant.id }] });
      
      toast({ 
        title: "Quote converted to invoice", 
        description: "Successfully created invoice from quote" 
      });
    } catch (error: any) {
      toast({ 
        title: "Error converting quote", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setConvertingQuoteId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "default",
      accepted: "default",
      rejected: "destructive",
      expired: "outline",
      converted: "outline",
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
          <h1 className="text-3xl font-semibold">Quotes</h1>
          <p className="text-muted-foreground">Manage your sales quotes</p>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-quote">
          <Plus className="w-4 h-4 mr-2" />
          New Quote
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : quotes && quotes.length > 0 ? (
        <div className="grid gap-4">
          {quotes.map((quote) => (
            <Card key={quote.id} data-testid={`card-quote-${quote.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-quote-number-${quote.id}`}>
                      {quote.quoteNumber || quote.id}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(quote.quoteDate).toLocaleDateString()} - 
                      Expires: {new Date(quote.expiryDate).toLocaleDateString()}
                    </p>
                    {quote.quoteSubject && (
                      <p className="text-sm mt-1">{quote.quoteSubject}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(quote.status)}
                    <span className="text-lg font-semibold" data-testid={`text-quote-total-${quote.id}`}>
                      {currenciesLoading ? '...' : formatCurrency(parseFloat(quote.total), quote.currencyCode, currencies)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(quote)}
                    data-testid={`button-edit-quote-${quote.id}`}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  {quote.status !== 'converted' && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleConvertToInvoice(quote.id)}
                      disabled={convertingQuoteId === quote.id}
                      data-testid={`button-convert-quote-${quote.id}`}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {convertingQuoteId === quote.id ? 'Converting...' : 'Convert to Invoice'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(quote.id)}
                    data-testid={`button-delete-quote-${quote.id}`}
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
          <p className="text-lg font-medium mb-2">No quotes yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first quote to get started</p>
          <Button onClick={handleCreate} data-testid="button-create-first-quote">
            <Plus className="mr-2 h-4 w-4" />
            Create Quote
          </Button>
        </div>
      )}

      <QuoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        quote={selectedQuote}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
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
