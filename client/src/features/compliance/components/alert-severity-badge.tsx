import { Badge } from "@/shared/components/ui/badge";

interface AlertSeverityBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
  className?: string;
}

export function AlertSeverityBadge({ severity, className }: AlertSeverityBadgeProps) {
  const variants = {
    low: { variant: "default" as const, className: "bg-green-600 text-white hover:bg-green-700" },
    medium: { variant: "default" as const, className: "bg-amber-600 text-white hover:bg-amber-700" },
    high: { variant: "default" as const, className: "bg-orange-600 text-white hover:bg-orange-700" },
    critical: { variant: "default" as const, className: "bg-red-600 text-white hover:bg-red-700" },
  };

  const config = variants[severity];
  
  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className || ""}`}
      data-testid={`badge-severity-${severity}`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}
