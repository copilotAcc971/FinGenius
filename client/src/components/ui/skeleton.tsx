import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableColumnDef, renderColgroup, getColumnClassName } from "@/lib/table-columns"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-100 dark:bg-neutral-800", className)}
      {...props}
    />
  )
}

interface TableSkeletonProps {
  rows?: number;
  columns: TableColumnDef[];
  minHeight?: string;
}

function TableSkeleton({ rows = 8, columns, minHeight }: TableSkeletonProps) {
  return (
    <div className="rounded-md border" style={{ minHeight }} data-testid="skeleton-table">
      <Table>
        {renderColgroup(columns)}
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={getColumnClassName(col)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col) => (
                <TableCell key={col.key} className={getColumnClassName(col)}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card border-card-border p-6 space-y-4" data-testid="skeleton-card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, TableSkeleton, CardSkeleton, ListSkeleton }
