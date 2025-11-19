import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";

export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";

interface ApprovalStatusBannerProps {
  status: ApprovalStatus;
  approverNames?: string[];
  approvedBy?: string;
  approvedAt?: string | Date;
  rejectedBy?: string;
  rejectedAt?: string | Date;
  rejectionReason?: string;
  isCurrentUserApprover?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onSubmitForApproval?: () => void;
  showSubmitButton?: boolean;
  isLoading?: boolean;
}

export function ApprovalStatusBanner({
  status,
  approverNames = [],
  approvedBy,
  approvedAt,
  rejectedBy,
  rejectedAt,
  rejectionReason,
  isCurrentUserApprover = false,
  onApprove,
  onReject,
  onSubmitForApproval,
  showSubmitButton = false,
  isLoading = false,
}: ApprovalStatusBannerProps) {
  const formatDate = (date: string | Date | undefined): string => {
    if (!date) return "";
    try {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  // Draft status - show submit button if applicable
  if (status === "draft") {
    if (showSubmitButton && onSubmitForApproval) {
      return (
        <Alert className="border-border" data-testid="banner-draft">
          <AlertCircle className="h-4 w-4" />
          <div className="flex items-center justify-between w-full gap-4">
            <AlertDescription>
              This document is in draft status. Submit it for approval when ready.
            </AlertDescription>
            <Button
              size="sm"
              onClick={onSubmitForApproval}
              disabled={isLoading}
              data-testid="button-submit-approval"
            >
              Submit for Approval
            </Button>
          </div>
        </Alert>
      );
    }
    return null; // Don't show banner for plain draft
  }

  // Pending approval
  if (status === "pending") {
    return (
      <Alert className="border-yellow-500" data-testid="banner-pending">
        <Clock className="h-4 w-4 text-yellow-600" />
        <div className="flex items-start justify-between w-full gap-4">
          <div className="flex-1">
            <AlertDescription>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                  Pending Approval
                </Badge>
              </div>
              {approverNames.length > 0 && (
                <p className="text-sm" data-testid="text-approvers">
                  Awaiting approval from: <span className="font-medium">{approverNames.join(", ")}</span>
                </p>
              )}
            </AlertDescription>
          </div>
          {isCurrentUserApprover && (onApprove || onReject) && (
            <div className="flex items-center gap-2">
              {onApprove && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={onApprove}
                  disabled={isLoading}
                  data-testid="button-approve"
                >
                  Approve
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onReject}
                  disabled={isLoading}
                  data-testid="button-reject"
                >
                  Reject
                </Button>
              )}
            </div>
          )}
        </div>
      </Alert>
    );
  }

  // Approved
  if (status === "approved") {
    return (
      <Alert className="border-green-500 bg-green-50" data-testid="banner-approved">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              Approved
            </Badge>
          </div>
          <p className="text-sm" data-testid="text-approval-details">
            Approved by <span className="font-medium">{approvedBy || "Unknown"}</span>
            {approvedAt && <span> on {formatDate(approvedAt)}</span>}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Rejected
  if (status === "rejected") {
    return (
      <Alert className="border-red-500 bg-red-50" data-testid="banner-rejected">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
              Rejected
            </Badge>
          </div>
          <p className="text-sm mb-2" data-testid="text-rejection-details">
            Rejected by <span className="font-medium">{rejectedBy || "Unknown"}</span>
            {rejectedAt && <span> on {formatDate(rejectedAt)}</span>}
          </p>
          {rejectionReason && (
            <div className="mt-2 p-2 bg-red-100 rounded-md">
              <p className="text-xs font-medium text-red-900">Reason:</p>
              <p className="text-sm text-red-800" data-testid="text-rejection-reason">
                {rejectionReason}
              </p>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
