import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Shield, Download, Search, Filter, CheckCircle, XCircle } from "lucide-react";
import type { AuditLog } from "@shared/schema";

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(0);
  const limit = 100;

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", { entityType, entityId, action, limit, offset: page * limit }],
  });

  const exportToCSV = () => {
    if (!logs.length) {
      return;
    }
    
    if (logs.length > 10000) {
      // Note: Since we're paginated, this is unlikely but good to have
      alert("Too many logs. Please filter to fewer than 10,000 logs before exporting.");
      return;
    }

    const headers = ["Timestamp", "User ID", "Action", "Entity Type", "Entity ID", "IP Address", "Status"];
    const rows = logs.map((log) => [
      format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
      log.userId || "System",
      log.action,
      log.entityType,
      log.entityId,
      log.ipAddress || "N/A",
      log.wasSuccessful ? "Success" : "Failed",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-audit-logs">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="w-8 h-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            SOX-compliant audit trail of all financial transactions and user actions
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={!logs.length} data-testid="button-export-csv">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter audit logs by entity type, action, or search by entity ID</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="customer_payment">Customer Payment</SelectItem>
                  <SelectItem value="journal_entry">Journal Entry</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="select-action">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search Entity ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID..."
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="pl-10"
                  data-testid="input-entity-id"
                />
              </div>
            </div>
          </div>

          {(entityType || action || entityId) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEntityType("");
                setAction("");
                setEntityId("");
                setPage(0);
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No audit logs found. Try adjusting your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                      <TableCell data-testid={`text-timestamp-${log.id}`}>
                        {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell data-testid={`text-user-${log.id}`}>
                        {log.userId || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-action-${log.id}`}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-entity-type-${log.id}`}>
                        {log.entityType}
                      </TableCell>
                      <TableCell className="font-mono text-xs" data-testid={`text-entity-id-${log.id}`}>
                        {log.entityId}
                      </TableCell>
                      <TableCell className="font-mono text-xs" data-testid={`text-ip-${log.id}`}>
                        {log.ipAddress || "N/A"}
                      </TableCell>
                      <TableCell>
                        {log.wasSuccessful ? (
                          <Badge variant="default" className="bg-green-500" data-testid={`badge-success-${log.id}`}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive" data-testid={`badge-failed-${log.id}`}>
                            <XCircle className="w-3 h-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          data-testid={`button-view-details-${log.id}`}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {!isLoading && logs.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {page * limit + 1} - {page * limit + logs.length} audit logs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="text-sm">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < limit}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Comprehensive details of this audit log entry
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{format(new Date(selectedLog.timestamp), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="text-sm font-mono">{selectedLog.userId || "System"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <p className="text-sm">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entity Type</p>
                  <p className="text-sm">{selectedLog.entityType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entity ID</p>
                  <p className="text-sm font-mono">{selectedLog.entityId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedLog.ipAddress || "N/A"}</p>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User Agent</p>
                  <p className="text-xs font-mono bg-muted p-2 rounded">{selectedLog.userAgent}</p>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div>
                  <p className="text-sm font-medium text-destructive">Error Message</p>
                  <p className="text-sm bg-destructive/10 p-2 rounded">{selectedLog.errorMessage}</p>
                </div>
              )}

              {selectedLog.changes && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Changes</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Before</p>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                        {JSON.stringify(selectedLog.changes.before, null, 2) || "null"}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">After</p>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                        {JSON.stringify(selectedLog.changes.after, null, 2) || "null"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
