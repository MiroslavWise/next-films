export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-[var(--radius-md)] border border-(--surface-border) bg-(--tg-theme-secondary-bg-color)"
        >
          <div className="aspect-9/16 animate-pulse bg-[color-mix(in_srgb,var(--tg-theme-hint-color)_14%,transparent)]" />
          <div className="grid gap-1 p-1.5">
            <div className="h-8 animate-pulse rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--tg-theme-hint-color)_14%,transparent)]" />
            <div className="h-8 animate-pulse rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--tg-theme-hint-color)_14%,transparent)]" />
            <div className="h-8 animate-pulse rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--tg-theme-hint-color)_14%,transparent)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
