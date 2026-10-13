import Link from "next/link"
import { buttonClass, panelClass } from "@/lib/ui"
import { copy } from "@/lib/constants"
import type { Game } from "@/lib/games"

export function GameCard({ game }: { game: Game }) {
  return (
    <article className={panelClass}>
      <h2 className="text-xl font-semibold tracking-tight">{game.title}</h2>
      <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-(--tg-theme-hint-color)">{game.description}</p>
      {game.status === "active" && game.href ? (
        <Link href={game.href} className={`${buttonClass} mt-4`}>
          {copy.play}
        </Link>
      ) : (
        <p className="mt-4 text-sm font-medium text-(--tg-theme-hint-color)">{copy.soon}</p>
      )}
    </article>
  )
}
