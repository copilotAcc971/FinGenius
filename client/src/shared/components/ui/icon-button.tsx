import React from "react";
import { Button, type ButtonProps } from "@/shared/components/ui/button";

/**
 * WCAG 2.2 Level A: Accessible Icon Button Component
 * Ensures all icon-only buttons have aria-labels for screen readers
 */
interface IconButtonProps extends ButtonProps {
  ariaLabel: string;
  title?: string;
  icon: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ ariaLabel, title, icon, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon"
        aria-label={ariaLabel}
        title={title || ariaLabel}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";
