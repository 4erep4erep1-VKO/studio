"use client";

import { Skeleton } from '@/components/ui/skeleton';

export function OrderCardSkeleton() {
  return (
    <div className="group border border-border/50 rounded-xl px-5 py-4 sm:p-5 hover:border-primary/20 transition-colors hover:shadow-md hover:shadow-primary/5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>

      {/* Status badge */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>

      {/* Image placeholder */}
      <Skeleton className="w-full h-32 rounded-lg" />

      {/* Footer info */}
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>

      {/* Action button */}
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
