import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreVertical, Pencil, Trash2, Upload, CheckCircle2, Loader2, Receipt } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useOptimisticUpdate } from "@/shared/hooks/optimistic-ui/useOptimisticUpdate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
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
import { BillDialog } from "@/features/bills/components/bill-dialog";
import { BulkBillUpload } from "@/features/bills/components/bulk-bill-upload";
import { PendingBadge } from "@/shared/components/ui/pending-badge";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { Bill, BillWithOptimistic, Vendor, Currency } from "@shared/schema";
import { formatCurrency } from "@/shared/lib/utils/currency-utils";
import { billColumns, renderColgroup, getColumnClassName } from "@/shared/lib/utils/table-columns";

export default function Bills() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

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

  const { data: bills = [], isLoading } = useQuery<BillWithOptimistic[]>({
    queryKey: ["/api/bills", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (billId: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/bills/${billId}?tenantId=${currentTenant.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({
        title: "Bill deleted",
        description: "Bill has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete bill",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Optimistic update for marking bill as paid
  const markAsPaidMutation = useOptimisticUpdate<BillWithOptimistic[]>({
    endpoint: '/api/bills',
    queryKey: ['/api/bills', { tenantId: currentTenant?.id }],
    idKey: 'id',
    successMessage: 'Bill marked as paid',
    errorMessage: 'Failed to mark bill as paid',
  });

  const handleAddBill = () => {
    setEditingBill(null);
    setShowDialog(true);
  };

  const handleEditBill = (bill: Bill) => {
    setEditingBill(bill);
    setShowDialog(true);
  };

  const handleDeleteBill = (billId: string) => {
    if (confirm("Are you sure you want to delete this bill?")) {
      deleteMutation.mutate(billId);
    }
  };

  const getVendorName = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name || vendorId;
  };

  // Calculate summary stats
  const totalBills = bills.length;
  const totalAmount = bills.reduce((sum, bill) => sum + parseFloat(bill.total), 0);
  const unpaidAmount = bills
    .filter(bill => bill.status === 'unpaid' || bill.status === 'overdue')
    .reduce((sum, bill) => sum + parseFloat(bill.total), 0);

  const getStatusBadge = (status: string, isPending?: boolean) => {
    if (isPending) {
      return <PendingBadge />;
    }
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      unpaid: "outline",
      scheduled: "secondary",
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
          <h1 className="text-3xl font-semibold">Bills</h1>
          <p className="text-muted-foreground">Manage bills from vendors</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowBulkUpload(true)} 
            data-testid="button-bulk-upload"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={handleAddBill} data-testid="button-create-bill">
            <Plus className="mr-2 h-4 w-4" />
            Add Bill
          </Button>
        </div>
      </div>

      {!isLoading && bills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-bills">{totalBills}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-amount">
                ${totalAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-unpaid-amount">
                ${unpaidAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} columns={billColumns} minHeight="600px" />
      ) : bills.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No bills yet"
          description="Add your first bill or upload a document for AI extraction"
          action={{
            label: "Add Bill",
            onClick: handleAddBill
          }}
          dataTestId="empty-state-bills"
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            {renderColgroup(billColumns)}
            <TableHeader>
              <TableRow>
                <TableHead className={getColumnClassName(billColumns[0])}>Bill #</TableHead>
                <TableHead className={getColumnClassName(billColumns[1])}>Vendor</TableHead>
                <TableHead className={getColumnClassName(billColumns[2])}>Date</TableHead>
                <TableHead className={getColumnClassName(billColumns[3])}>Due Date</TableHead>
                <TableHead className={getColumnClassName(billColumns[4])}>Amount</TableHead>
                <TableHead className={getColumnClassName(billColumns[5])}>Status</TableHead>
                <TableHead className={getColumnClassName(billColumns[6])}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id} data-testid={`row-bill-${bill.id}`} className={bill.isPending ? "opacity-60" : ""}>
                  <TableCell className={`${getColumnClassName(billColumns[0])} font-medium font-mono`}>{bill.billNumber}</TableCell>
                  <TableCell className={getColumnClassName(billColumns[1])}>{getVendorName(bill.vendorId)}</TableCell>
                  <TableCell className={getColumnClassName(billColumns[2])}>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                  <TableCell className={getColumnClassName(billColumns[3])}>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className={`${getColumnClassName(billColumns[4])} font-mono`} data-testid={`amount-${bill.id}`}>
                    {currenciesLoading ? '...' : formatCurrency(parseFloat(bill.total), bill.currencyCode, currencies)}
                  </TableCell>
                  <TableCell className={getColumnClassName(billColumns[5])}>{getStatusBadge(bill.status, bill.isPending)}</TableCell>
                  <TableCell className={getColumnClassName(billColumns[6])}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          data-testid={`button-bill-actions-${bill.id}`} 
                          disabled={bill.isPending}
                          aria-label={`Actions for bill ${bill.billNumber || bill.id}`}
                          title="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleEditBill(bill as Bill)}
                          data-testid={`button-edit-bill-${bill.id}`}
                          disabled={bill.isPending}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {bill.status !== 'paid' && bill.status !== 'cancelled' && (
                          <DropdownMenuItem
                            onClick={() => {
                              markAsPaidMutation.mutate({
                                id: bill.id,
                                data: { 
                                  status: 'paid',
                                }
                              });
                            }}
                            disabled={markAsPaidMutation.isPending || bill.isPending}
                            data-testid={`button-mark-paid-${bill.id}`}
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
                          onClick={() => handleDeleteBill(bill.id)}
                          className="text-destructive"
                          data-testid={`button-delete-bill-${bill.id}`}
                          disabled={bill.isPending}
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

      <BillDialog 
        open={showDialog} 
        onOpenChange={setShowDialog} 
        bill={editingBill} 
      />

      {currentTenant?.id && (
        <BulkBillUpload
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          tenantId={currentTenant.id}
        />
      )}
    </div>
  );
}
