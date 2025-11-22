import { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

interface TooltipWrapperProps {
  content: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
  data_testid?: string;
}

export function TooltipWrapper({
  content,
  children,
  side = "top",
  delay = 200,
  data_testid,
}: TooltipWrapperProps) {
  return (
    <Tooltip delayDuration={delay}>
      <TooltipTrigger asChild data-testid={data_testid}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}
