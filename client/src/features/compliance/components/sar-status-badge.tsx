import { Badge } from "@/shared/components/ui/badge";

interface SARStatusBadgeProps {
  status: "draft" | "under_review" | "approved" | "filed" | "rejected";
  className?: string;
}

export function SARStatusBadge({ status, className }: SARStatusBadgeProps) {
  const variants = {
    draft: { variant: "secondary" as const, className: "" },
    under_review: { variant: "default" as const, className: "bg-amber-600 text-white hover:bg-amber-700" },
    approved: { variant: "default" as const, className: "bg-blue-600 text-white hover:bg-blue-700" },
    filed: { variant: "default" as const, className: "bg-green-600 text-white hover:bg-green-700" },
    rejected: { variant: "default" as const, className: "bg-red-600 text-white hover:bg-red-700" },
  };

  const config = variants[status];
  const displayText = status.replace(/_/g, " ");
  
  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className || ""}`}
      data-testid={`badge-sar-${status}`}
    >
      {displayText.charAt(0).toUpperCase() + displayText.slice(1)}
    </Badge>
  );
}
