import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { useRBAC } from "@/shared/contexts/rbac-context";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import { AdvancedDataTable } from "@/shared/components/tables/advanced-data-table";
import type { AdvancedColumnDef } from "@/shared/lib/utils/advanced-table-types";
import type { NrvAssessment, Item } from "@shared/schema";
import { NrvAssessmentDialog } from "../components/nrv-assessment-dialog";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function NrvAssessmentPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | undefined>(undefined);
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasPermission } = useRBAC();

  const { data: assessments = [], isLoading } = useQuery<NrvAssessment[]>({
    queryKey: ["/api/nrv-assessments", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const { data: itemsRequiringNrv = [] } = useQuery<Item[]>({
    queryKey: ["/api/items/nrv-required", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const canWrite = hasPermission("nrv.write");

  const approveMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      if (!canWrite) {
        throw new Error("You don't have permission to approve NRV assessments");
      }
      return await apiRequest(`/api/nrv-assessments/${assessmentId}/approve`, "PUT", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nrv-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({
        title: "Assessment approved",
        description: "Journal entry has been created for the write-down.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve assessment.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const getItemName = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    return item?.name || "Unknown Item";
  };

  const columns: AdvancedColumnDef<NrvAssessment>[] = useMemo(() => [
    {
      key: "assessmentDate",
      header: "Assessment Date",
      accessorKey: "assessmentDate",
      cell: ({ row }) => (
        <span className="text-sm">
          {format(new Date(row.original.assessmentDate), "PPP")}
        </span>
      ),
      enableSorting: true,
      width: "140px",
    },
    {
      key: "itemId",
      header: "Item",
      accessorKey: "itemId",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{getItemName(row.original.itemId)}</div>
        </div>
      ),
      enableSorting: false,
      width: "200px",
    },
    {
      key: "costValue",
      header: "Cost",
      accessorKey: "costValue",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{formatCurrency(row.original.costValue)}</span>
      ),
      enableSorting: true,
      width: "120px",
    },
    {
      key: "nrvValue",
      header: "NRV",
      accessorKey: "nrvValue",
      cell: ({ row }) => (
        <span className="font-mono text-sm">{formatCurrency(row.original.nrvValue)}</span>
      ),
      enableSorting: true,
      width: "120px",
    },
    {
      key: "writeDownAmount",
      header: "Write-Down",
      accessorKey: "writeDownAmount",
      cell: ({ row }) => {
        const amount = parseFloat(row.original.writeDownAmount);
        return (
          <span className={`font-mono text-sm ${amount > 0 ? 'text-destructive font-semibold' : ''}`}>
            {formatCurrency(row.original.writeDownAmount)}
          </span>
        );
      },
      enableSorting: true,
      width: "120px",
    },
    {
      key: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = status === "approved" ? "default" : status === "pending" ? "outline" : "secondary";
        return (
          <Badge variant={variant} className="capitalize" data-testid={`badge-status-${row.original.id}`}>
            {status}
          </Badge>
        );
      },
      enableSorting: true,
      width: "100px",
    },
    {
      key: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const status = row.original.status;
        const writeDownAmount = parseFloat(row.original.writeDownAmount);
        
        if (status === "pending" && writeDownAmount > 0 && canWrite) {
          return (
            <Button
              size="sm"
              onClick={() => approveMutation.mutate(row.original.id)}
              disabled={approveMutation.isPending}
              data-testid={`button-approve-${row.original.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
          );
        }
        
        if (status === "approved") {
          return (
            <Badge variant="default" data-testid={`badge-approved-${row.original.id}`}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Posted
            </Badge>
          );
        }
        
        return <span className="text-sm text-muted-foreground">-</span>;
      },
      enableSorting: false,
      width: "120px",
    },
  ], [items, canWrite, approveMutation]);

  const handleCreateAssessment = (item?: Item) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedItem(undefined);
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NRV Assessments (IAS 2)</h1>
          <p className="text-muted-foreground mt-1">
            Manage Net Realizable Value assessments for inventory items
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => handleCreateAssessment()} data-testid="button-create-assessment">
            <Plus className="h-4 w-4 mr-2" />
            New Assessment
          </Button>
        )}
      </div>

      {itemsRequiringNrv.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Items Requiring NRV Assessment
            </CardTitle>
            <CardDescription>
              {itemsRequiringNrv.length} item{itemsRequiringNrv.length === 1 ? '' : 's'} may require write-down
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {itemsRequiringNrv.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-md">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Cost: {formatCurrency(item.purchasePrice)} | 
                      NRV: {formatCurrency(item.nrvValue || String(parseFloat(item.rate || "0") * 0.95))}
                    </div>
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateAssessment(item)}
                      data-testid={`button-assess-${item.id}`}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Assess
                    </Button>
                  )}
                </div>
              ))}
              {itemsRequiringNrv.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  ...and {itemsRequiringNrv.length - 5} more items
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assessment History</CardTitle>
          <CardDescription>
            All NRV assessments for inventory items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdvancedDataTable
            columns={columns}
            data={assessments}
            isLoading={isLoading}
            searchableColumns={["itemId"]}
            filterableColumns={[
              {
                key: "status",
                label: "Status",
                options: [
                  { label: "Pending", value: "pending" },
                  { label: "Approved", value: "approved" },
                  { label: "Applied", value: "applied" },
                ],
              },
            ]}
            exportFileName="nrv-assessments"
          />
        </CardContent>
      </Card>

      <NrvAssessmentDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        item={selectedItem}
      />
    </div>
  );
}
