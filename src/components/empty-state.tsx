import Link from "next/link"
import { buttonClass, panelClass } from "@/lib/ui"
import { copy } from "@/lib/constants"

export function EmptyState() {
  return (
    <div className={`${panelClass} p-6 text-center`}>
      <h2 className="text-xl font-semibold tracking-tight">{copy.emptyTitle}</h2>
      <p className="mx-auto mt-2 max-w-[65ch] text-sm leading-relaxed text-(--tg-theme-hint-color)">{copy.emptyText}</p>
      <Link href="/" className={`${buttonClass} mt-4`}>
        {copy.backHome}
      </Link>
    </div>
  )
}
