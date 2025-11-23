import { Suspense, lazy, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2, MoreHorizontal, AlertCircle, Landmark } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { TableSkeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
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
import { useTenant } from "@/shared/hooks/useTenant";
import { useToast } from "@/shared/hooks/use-toast";
import { apiRequest, queryClient } from "@/shared/lib/api/queryClient";
import type { OpenBankingConnection } from "@shared/schema";
import { format } from "date-fns";

const ConnectBankDialog = lazy(() => import("@/features/banking/components/connect-bank-dialog").then(m => ({ default: m.ConnectBankDialog })));

export default function BankConnections() {
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const { data: connections = [], isLoading } = useQuery<OpenBankingConnection[]>({
    queryKey: ["/api/open-banking/connections", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  const refreshMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/open-banking/connections/${connectionId}/refresh`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/open-banking/connections", { tenantId: currentTenant?.id }] 
      });
      toast({
        title: "Connection refreshed",
        description: "Bank connection tokens have been refreshed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to refresh connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      await apiRequest(`/api/open-banking/connections/${connectionId}`, "DELETE", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/open-banking/connections", { tenantId: currentTenant?.id }] 
      });
      toast({
        title: "Bank disconnected",
        description: "Bank connection has been removed successfully.",
      });
      setDisconnectingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to disconnect bank",
        description: error.message,
        variant: "destructive",
      });
      setDisconnectingId(null);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      disconnected: "secondary",
      expired: "secondary",
      error: "destructive",
      pending_reauth: "outline",
    };
    return (
      <Badge 
        variant={variants[status] || "secondary"} 
        data-testid={`badge-status-${status}`}
      >
        {status.replace(/_/g, ' ').charAt(0).toUpperCase() + status.replace(/_/g, ' ').slice(1)}
      </Badge>
    );
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Never";
    try {
      return format(new Date(date), "MMM d, yyyy HH:mm");
    } catch {
      return "Invalid date";
    }
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
          <h1 className="text-3xl font-semibold">Bank Connections</h1>
          <p className="text-muted-foreground">Manage your Open Banking connections</p>
        </div>
        <Button
          onClick={() => setShowConnectDialog(true)}
          data-testid="button-connect-bank"
        >
          <Plus className="mr-2 h-4 w-4" />
          Connect New Bank
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6"><TableSkeleton rows={5} columns={[{key: "1", header: "", width: "100px"}, {key: "2", header: "", width: "150px"}, {key: "3", header: "", width: "100px"}, {key: "4", header: "", width: "150px"}, {key: "5", header: "", width: "80px"}, {key: "6", header: "", width: "120px"}, {key: "7", header: "", width: "100px"}, {key: "8", header: "", width: "70px"}]} minHeight="300px" /></div>
      ) : connections.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No bank connections yet"
          description="Connect your first bank to enable automatic transaction syncing"
          action={{
            label: "Connect Your First Bank",
            onClick: () => setShowConnectDialog(true)
          }}
          dataTestId="empty-state-bank-connections"
        />
      ) : (
        <div className="border rounded-lg">
          <Table data-testid="table-connections">
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Bank Name</TableHead>
                <TableHead>Account Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((connection) => (
                <TableRow key={connection.id} data-testid={`row-connection-${connection.id}`}>
                  <TableCell className="font-medium capitalize">
                    {connection.provider}
                  </TableCell>
                  <TableCell>{connection.bankName || "Unknown Bank"}</TableCell>
                  <TableCell className="capitalize">
                    {connection.accountType?.replace(/_/g, ' ') || "N/A"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {connection.accountMask ? `****${connection.accountMask}` : "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(connection.status)}
                      {connection.syncErrors && connection.syncErrors > 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {connection.syncErrors} error(s)
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(connection.lastSyncAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {Array.isArray(connection.permissions) && connection.permissions.length > 0 
                      ? connection.permissions.join(", ") 
                      : "None"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          data-testid={`button-actions-${connection.id}`}
                          aria-label={`Actions for bank connection ${connection.bankName || "Unknown Bank"}`}
                          title="More options"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => refreshMutation.mutate(connection.id)}
                          disabled={refreshMutation.isPending}
                          data-testid={`button-refresh-${connection.id}`}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Connection
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDisconnectingId(connection.id)}
                          className="text-destructive"
                          data-testid={`button-disconnect-${connection.id}`}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Disconnect
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

      {showConnectDialog && (
        <Suspense fallback={null}>
          <ConnectBankDialog
            open={showConnectDialog}
            onOpenChange={setShowConnectDialog}
          />
        </Suspense>
      )}

      <AlertDialog open={!!disconnectingId} onOpenChange={() => setDisconnectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Bank Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the bank connection and stop automatic transaction syncing. 
              You can reconnect this bank at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectingId && disconnectMutation.mutate(disconnectingId)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-disconnect"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
