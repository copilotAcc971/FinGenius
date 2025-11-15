import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Clock,
  Check,
  X,
  AlertCircle,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PendingApproval } from "@/types/approvals";

export default function PendingApprovals() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading } = useQuery<PendingApproval[]>({
    queryKey: ["/api/approvals/pending", { tenantId: currentTenant?.id }],
    enabled: !!currentTenant?.id,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ entityId, comments }: { entityId: string; comments?: string }) => {
      return apiRequest(
        `/api/journal-entries/${entityId}/approve`,
        "POST",
        { comments }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending", { tenantId: currentTenant?.id }] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries", { tenantId: currentTenant?.id }] });
      toast({
        title: "Approved",
        description: "Approval request has been approved successfully",
      });
      setShowApproveDialog(false);
      setApproveComments("");
      setSelectedApproval(null);
    },
    onError: (error: any) => {
      toast({
        title: "Approval failed",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ entityId, rejectionReason }: { entityId: string; rejectionReason: string }) => {
      return apiRequest(
        `/api/journal-entries/${entityId}/reject`,
        "POST",
        { rejectionReason }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending", { tenantId: currentTenant?.id }] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries", { tenantId: currentTenant?.id }] });
      toast({
        title: "Rejected",
        description: "Approval request has been rejected",
      });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedApproval(null);
    },
    onError: (error: any) => {
      toast({
        title: "Rejection failed",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    if (!selectedApproval) return;
    approveMutation.mutate({
      entityId: selectedApproval.entityId,
      comments: approveComments || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedApproval || !rejectReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({
      entityId: selectedApproval.entityId,
      rejectionReason: rejectReason,
    });
  };

  const openApproveDialog = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setShowApproveDialog(true);
  };

  const openRejectDialog = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setShowRejectDialog(true);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getUserName = (user: PendingApproval['requester']) => {
    if (!user) return "—";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName} ${lastName}`.trim() || user.email || "—";
  };

  const getDaysPending = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (approvalDeadline: string | null) => {
    if (!approvalDeadline) return false;
    return new Date(approvalDeadline) < new Date();
  };

  // Filter approvals by entity type
  const filteredApprovals = useMemo(() => {
    if (entityTypeFilter === "all") return pendingApprovals;
    return pendingApprovals.filter(a => a.entityType === entityTypeFilter);
  }, [pendingApprovals, entityTypeFilter]);

  // Get unique entity types for filter
  const entityTypes = useMemo(() => {
    const types = new Set(pendingApprovals.map(a => a.entityType));
    return Array.from(types);
  }, [pendingApprovals]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-8 w-12" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Pending Approvals
          </h1>
          <Badge variant="secondary" data-testid="badge-count">
            {filteredApprovals.length}
          </Badge>
        </div>
        
        {entityTypes.length > 0 && (
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-48" data-testid="select-entity-type-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="select-item-all">
                All Types
              </SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type} data-testid={`select-item-${type}`}>
                  {type === "journal_entry" ? "Journal Entry" : type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Approvals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Awaiting Your Approval</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredApprovals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Check className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground max-w-md">
                You have no pending approval requests at the moment.
              </p>
            </div>
          ) : (
            <Table data-testid="table-pending-approvals">
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Workflow Step</TableHead>
                  <TableHead>Days Pending</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApprovals.map((approval) => {
                  const daysPending = getDaysPending(approval.createdAt);
                  const overdue = isOverdue(approval.approvalDeadline);
                  
                  return (
                    <TableRow key={approval.id} data-testid={`row-approval-${approval.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {approval.entityType === "journal_entry" && (
                            <Link
                              href={`/journal-entries/${approval.entityId}`}
                              className="font-medium hover:underline"
                              data-testid={`link-entry-${approval.entityId}`}
                            >
                              {approval.entity.journalEntryNumber || approval.entityId.substring(0, 8)}
                              <ExternalLink className="inline h-3 w-3 ml-1" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-date-${approval.id}`}>
                        {formatDate(approval.entity.entryDate)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" data-testid={`text-description-${approval.id}`}>
                        {approval.entity.description || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono" data-testid={`text-amount-${approval.id}`}>
                        {formatCurrency(
                          parseFloat(approval.entity.totalAmount),
                          approval.entity.currencyCode || "USD"
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-requester-${approval.id}`}>
                        {getUserName(approval.requester)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" data-testid={`badge-step-${approval.id}`}>
                            Step {approval.currentStep} of {approval.workflow.totalSteps}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {approval.workflow.currentStepName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span
                            className={overdue ? "text-destructive font-medium" : ""}
                            data-testid={`text-days-pending-${approval.id}`}
                          >
                            {daysPending} {daysPending === 1 ? "day" : "days"}
                          </span>
                          {overdue && (
                            <Badge variant="destructive" data-testid={`badge-overdue-${approval.id}`}>
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openApproveDialog(approval)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-approve-${approval.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openRejectDialog(approval)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-reject-${approval.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent data-testid="dialog-approve">
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription>
              You are approving{" "}
              <strong>
                {selectedApproval?.entity.journalEntryNumber ||
                  selectedApproval?.entityId.substring(0, 8)}
              </strong>
              . You can optionally add comments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-comments">Comments (Optional)</Label>
              <Textarea
                id="approve-comments"
                placeholder="Add any comments or notes..."
                value={approveComments}
                onChange={(e) => setApproveComments(e.target.value)}
                rows={4}
                data-testid="textarea-approve-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveDialog(false);
                setApproveComments("");
                setSelectedApproval(null);
              }}
              disabled={approveMutation.isPending}
              data-testid="button-approve-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              data-testid="button-approve-confirm"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Reject Request
            </DialogTitle>
            <DialogDescription>
              You are rejecting{" "}
              <strong>
                {selectedApproval?.entity.journalEntryNumber ||
                  selectedApproval?.entityId.substring(0, 8)}
              </strong>
              . Please provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reject-reason"
                placeholder="Explain why you are rejecting this request..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                data-testid="textarea-reject-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
                setSelectedApproval(null);
              }}
              disabled={rejectMutation.isPending}
              data-testid="button-reject-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-reject-confirm"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
