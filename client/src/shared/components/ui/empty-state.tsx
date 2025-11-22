import { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
  dataTestId: string; // Required for unique identification
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className = "",
  dataTestId,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
      data-testid={dataTestId}
    >
      {Icon && (
        <Icon className="h-12 w-12 text-secondary mb-4" aria-hidden="true" />
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-secondary max-w-sm mb-6">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          data-testid={`button-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
          aria-label={`${action.label}`}
        >
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
