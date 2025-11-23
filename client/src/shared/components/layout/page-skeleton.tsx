import { Skeleton } from "@/shared/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Page Title Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Content Skeleton - mimics common list/table layout */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Footer Skeleton */}
      <div className="pt-4 space-y-2">
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}
