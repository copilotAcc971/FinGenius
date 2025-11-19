import { format } from "date-fns";
import { Clock, User } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Button } from "@/shared/components/ui/button";

interface AuditInfo {
  createdBy?: string;
  createdByName?: string;
  createdAt?: string | Date;
  modifiedBy?: string;
  modifiedByName?: string;
  modifiedAt?: string | Date;
  versionCount?: number;
}

interface AuditTrailDisplayProps {
  auditInfo: AuditInfo;
  onViewHistory?: () => void;
}

export function AuditTrailDisplay({ auditInfo, onViewHistory }: AuditTrailDisplayProps) {
  const {
    createdByName,
    createdAt,
    modifiedByName,
    modifiedAt,
    versionCount = 1,
  } = auditInfo;

  const formatDateTime = (date: string | Date | undefined): string => {
    if (!date) return "N/A";
    try {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      return format(dateObj, "MMM d, yyyy 'at' h:mm a");
    } catch {
      return "N/A";
    }
  };

  if (!createdAt && !modifiedAt) {
    return null;
  }

  return (
    <Card className="p-4" data-testid="audit-trail-display">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium" data-testid="text-audit-heading">
            Document History
          </h3>
          {versionCount > 1 && onViewHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewHistory}
              data-testid="button-view-history"
            >
              View Change History ({versionCount} versions)
            </Button>
          )}
        </div>

        <Separator />

        {/* Created Info */}
        {createdAt && (
          <div className="flex items-start gap-3" data-testid="audit-created">
            <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">Created by </span>
                <span className="text-muted-foreground" data-testid="text-created-by">
                  {createdByName || "Unknown"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                <span data-testid="text-created-at">{formatDateTime(createdAt)}</span>
              </p>
            </div>
          </div>
        )}

        {/* Modified Info */}
        {modifiedAt && modifiedAt !== createdAt && (
          <>
            <Separator />
            <div className="flex items-start gap-3" data-testid="audit-modified">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">Last modified by </span>
                  <span className="text-muted-foreground" data-testid="text-modified-by">
                    {modifiedByName || "Unknown"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  <span data-testid="text-modified-at">{formatDateTime(modifiedAt)}</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
