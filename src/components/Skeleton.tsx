/**
 * A pulsing placeholder shaped like the content it's standing in for —
 * used instead of plain "Loading..." text, which reads as slower and
 * less finished than an actual skeleton even when the wait is the same.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-track rounded-xl ${className}`} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
      <div className="flex-grow min-w-0 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-14 shrink-0" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-1">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
