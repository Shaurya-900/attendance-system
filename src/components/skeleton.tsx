/** Placeholder shown instantly on navigation while the page's data loads. */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-current opacity-10 ${className}`} />;
}

export function PageSkeleton({ cards = 2, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Bar className="h-8 w-48" />
      {cards > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="card space-y-2"><Bar className="h-4 w-1/3" /><Bar className="h-6 w-1/2" /></div>
          ))}
        </div>
      )}
      <div className="card space-y-3">
        {Array.from({ length: rows }, (_, i) => <Bar key={i} className="h-4 w-full" />)}
      </div>
    </div>
  );
}
