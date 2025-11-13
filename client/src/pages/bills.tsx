import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Bill } from "@shared/schema";

export default function Bills() {
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

  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills", currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

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
        <Button data-testid="button-create-bill">
          <Plus className="mr-2 h-4 w-4" />
          Add Bill
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : bills.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-lg font-medium mb-2">No bills yet</p>
          <p className="text-sm text-muted-foreground mb-4">Add your first bill or upload a document for AI extraction</p>
          <Button data-testid="button-add-first-bill">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id} className="cursor-pointer hover-elevate" data-testid={`row-bill-${bill.id}`}>
                  <TableCell className="font-medium font-mono">{bill.billNumber}</TableCell>
                  <TableCell>{bill.vendorId}</TableCell>
                  <TableCell>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right font-mono">${parseFloat(bill.total).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(bill.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
