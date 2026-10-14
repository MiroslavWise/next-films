import { panelClass } from "@/lib/ui"

function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton-bone rounded-sm ${className}`} />
}

export function MovieListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="grid gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={`${panelClass} flex gap-3 p-3`}>
          <Bone className="h-24 w-16 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1">
            <Bone className="h-4 w-3/5 max-w-48" />
            <Bone className="h-3 w-24" />
            <div className="mt-1 flex gap-3">
              <Bone className="h-3 w-16" />
              <Bone className="h-3 w-16" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function RowsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className={`${panelClass} divide-y divide-(--surface-border) p-0`} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center justify-between gap-3 px-4 py-3.5">
          <Bone className="h-4 w-40 max-w-[55%]" />
          <div className="flex gap-4">
            <Bone className="h-3 w-14" />
            <Bone className="h-3 w-14" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MovieFormSkeleton() {
  return (
    <div className={`${panelClass} grid gap-4`} aria-hidden="true">
      <div className="grid gap-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-11 w-full" />
      </div>
      <div className="grid gap-2">
        <Bone className="h-3 w-16" />
        <Bone className="h-16 w-full" />
      </div>
      {[0, 1, 2, 3].map((block) => (
        <div key={block} className="grid gap-2">
          <Bone className="h-3 w-24" />
          <div className="flex flex-wrap gap-2">
            <Bone className="h-8 w-20" />
            <Bone className="h-8 w-24" />
            <Bone className="h-8 w-16" />
          </div>
        </div>
      ))}
      <Bone className="h-11 w-28" />
    </div>
  )
}

export function AdminNavSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <nav className={`${panelClass} divide-y divide-(--surface-border) p-0`} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="grid flex-1 gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-3 w-40 max-w-[70%]" />
          </div>
          <Bone className="h-4 w-3" />
        </div>
      ))}
    </nav>
  )
}
