export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="card animate-fade-in space-y-3 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
