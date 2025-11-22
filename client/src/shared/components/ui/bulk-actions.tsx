import { Button } from "@/shared/components/ui/button";
import { Trash2, Download, Copy } from "lucide-react";
import { useState } from "react";

interface BulkActionsProps {
  selectedCount: number;
  onDelete?: () => void;
  onExport?: () => void;
  onDuplicate?: () => void;
  isLoading?: boolean;
  data_testid?: string;
}

export function BulkActions({
  selectedCount,
  onDelete,
  onExport,
  onDuplicate,
  isLoading = false,
  data_testid = "bulk-actions",
}: BulkActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  const handleDelete = () => {
    if (showConfirm) {
      onDelete?.();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  return (
    <div
      className="flex items-center gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20"
      data-testid={data_testid}
      role="region"
      aria-label={`Bulk actions: ${selectedCount} items selected`}
    >
      <span className="text-sm font-medium text-foreground">
        {selectedCount} selected
      </span>

      <div className="flex gap-2 ml-auto">
        {onExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            disabled={isLoading}
            data-testid="button-bulk-export"
            aria-label="Export selected items"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}

        {onDuplicate && (
          <Button
            size="sm"
            variant="outline"
            onClick={onDuplicate}
            disabled={isLoading}
            data-testid="button-bulk-duplicate"
            aria-label="Duplicate selected items"
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </Button>
        )}

        {onDelete && (
          <Button
            size="sm"
            variant={showConfirm ? "destructive" : "outline"}
            onClick={handleDelete}
            disabled={isLoading}
            data-testid="button-bulk-delete"
            aria-label={showConfirm ? "Confirm delete" : "Delete selected items"}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {showConfirm ? "Confirm Delete" : "Delete"}
          </Button>
        )}
      </div>
    </div>
  );
}
