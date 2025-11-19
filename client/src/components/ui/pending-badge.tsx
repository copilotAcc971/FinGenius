import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PendingBadgeProps {
  /** Whether to show the pending badge */
  isPending?: boolean;
}

/**
 * Badge component that displays a loading spinner for optimistic updates
 * Only renders when isPending is true
 * 
 * @example
 * ```tsx
 * // In a table row with optimistic item
 * <TableRow className={invoice.isPending ? 'opacity-60' : ''}>
 *   <TableCell>{invoice.invoiceNumber}</TableCell>
 *   <TableCell>
 *     <PendingBadge isPending={invoice.isPending} />
 *   </TableCell>
 * </TableRow>
 * ```
 * 
 * @example
 * ```tsx
 * // Next to a status badge
 * <div className="flex items-center gap-2">
 *   <StatusBadge status={item.status} />
 *   <PendingBadge isPending={item.isPending} />
 * </div>
 * ```
 */
export function PendingBadge({ isPending }: PendingBadgeProps) {
  if (!isPending) return null;

  return (
    <Badge 
      variant="outline" 
      className="text-gray-500 dark:text-gray-400"
      data-testid="badge-pending"
    >
      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      Pending...
    </Badge>
  );
}
