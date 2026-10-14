import Link from "next/link"
import { buttonClass, panelClass } from "@/lib/ui"
import { copy } from "@/lib/constants"

export function PlayoffEmptyState({ available }: { available?: number }) {
  return (
    <div className={`${panelClass} p-6 text-center`}>
      <h2 className="text-xl font-semibold tracking-tight">{copy.emptyTitle}</h2>
      <p className="mx-auto mt-2 max-w-[65ch] text-sm leading-relaxed text-(--tg-theme-hint-color)">
        {copy.playoffEmptyText}
        {typeof available === "number" ? ` Сейчас в каталоге: ${available}.` : null}
      </p>
      <Link href="/" className={`${buttonClass} mt-4`}>
        {copy.backHome}
      </Link>
    </div>
  )
}
