export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="overflow-hidden rounded-2xl bg-[var(--tg-theme-secondary-bg-color)]">
          <div className="aspect-[9/16] animate-pulse bg-black/10 dark:bg-white/10" />
          <div className="grid gap-1 p-1.5">
            <div className="h-8 animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
            <div className="h-8 animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
            <div className="h-8 animate-pulse rounded-xl bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
