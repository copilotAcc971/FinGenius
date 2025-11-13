import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreVertical, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { BillDialog } from "@/components/bill-dialog";
import { BulkBillUpload } from "@/components/bulk-bill-upload";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Bill, Vendor } from "@shared/schema";

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

  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", currentTenant?.id],
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

  const getStatusBadge = (status: string) => {
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : bills.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No bills yet</p>
          <p className="text-sm text-muted-foreground mb-4">Add your first bill or upload a document for AI extraction</p>
          <Button onClick={handleAddBill} data-testid="button-add-first-bill">
            <Plus className="mr-2 h-4 w-4" />
            Add Bill
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id} data-testid={`row-bill-${bill.id}`}>
                  <TableCell className="font-medium font-mono">{bill.billNumber}</TableCell>
                  <TableCell>{getVendorName(bill.vendorId)}</TableCell>
                  <TableCell>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono">${parseFloat(bill.total).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(bill.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-bill-actions-${bill.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleEditBill(bill)}
                          data-testid={`button-edit-bill-${bill.id}`}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteBill(bill.id)}
                          className="text-destructive"
                          data-testid={`button-delete-bill-${bill.id}`}
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
