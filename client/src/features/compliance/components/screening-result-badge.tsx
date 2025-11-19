import { Badge } from "@/shared/components/ui/badge";

interface ScreeningResultBadgeProps {
  result: "clear" | "potential_match" | "match";
  className?: string;
}

export function ScreeningResultBadge({ result, className }: ScreeningResultBadgeProps) {
  const variants = {
    clear: { variant: "default" as const, className: "bg-green-600 text-white hover:bg-green-700" },
    potential_match: { variant: "default" as const, className: "bg-amber-600 text-white hover:bg-amber-700" },
    match: { variant: "default" as const, className: "bg-red-600 text-white hover:bg-red-700" },
  };

  const config = variants[result];
  const displayText = result.replace(/_/g, " ");
  
  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className || ""}`}
      data-testid={`badge-screening-${result}`}
    >
      {displayText.charAt(0).toUpperCase() + displayText.slice(1)}
    </Badge>
  );
}
