import { Badge } from "@/shared/components/ui/badge";

interface VerificationStatusBadgeProps {
  status: "pending" | "in_progress" | "verified" | "rejected" | "expired";
  className?: string;
}

export function VerificationStatusBadge({ status, className }: VerificationStatusBadgeProps) {
  const variants = {
    pending: { variant: "default" as const, className: "bg-amber-600 text-white hover:bg-amber-700" },
    in_progress: { variant: "default" as const, className: "bg-blue-600 text-white hover:bg-blue-700" },
    verified: { variant: "default" as const, className: "bg-green-600 text-white hover:bg-green-700" },
    rejected: { variant: "default" as const, className: "bg-red-600 text-white hover:bg-red-700" },
    expired: { variant: "secondary" as const, className: "" },
  };

  const config = variants[status];
  const displayText = status.replace(/_/g, " ");
  
  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className || ""}`}
      data-testid={`badge-verification-${status}`}
    >
      {displayText.charAt(0).toUpperCase() + displayText.slice(1)}
    </Badge>
  );
}
