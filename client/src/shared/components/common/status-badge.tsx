import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils/utils";

type StatusType = "invoice" | "bill" | "payment" | "approval";

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  className?: string;
}

export function StatusBadge({ status, type = "invoice", className }: StatusBadgeProps) {
  const getVariant = () => {
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus === "paid" || lowerStatus === "completed" || lowerStatus === "approved") {
      return "default";
    }
    
    if (lowerStatus === "overdue" || lowerStatus === "cancelled" || lowerStatus === "rejected" || lowerStatus === "failed") {
      return "destructive";
    }
    
    if (lowerStatus === "draft" || lowerStatus === "pending_review") {
      return "secondary";
    }
    
    return "outline";
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={cn("whitespace-nowrap", className)}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {formatStatus(status)}
    </Badge>
  );
}
