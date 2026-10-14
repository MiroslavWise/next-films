import Link from "next/link"
import { GameIcon } from "@/components/game-icons"
import { panelClass } from "@/lib/ui"
import { copy } from "@/lib/constants"
import { GameStatus, type Game } from "@/lib/games"

export function GameCard({ game }: { game: Game }) {
  const isActive = game.status === GameStatus.Active && Boolean(game.href)
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-(--tg-theme-bg-color) text-(--tg-theme-button-color) ring-1 ring-(--surface-border)">
          <GameIcon slug={game.slug} className="size-7" />
        </span>
        {!isActive ? (
          <span className="rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-(--tg-theme-hint-color) ring-1 ring-(--surface-border)">
            {copy.soon}
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 text-base font-semibold leading-snug tracking-tight">{game.title}</h2>
      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-(--tg-theme-hint-color)">{game.description}</p>
      {isActive ? (
        <span className="mt-auto pt-3 text-sm font-semibold text-(--tg-theme-link-color)">{copy.play}</span>
      ) : null}
    </>
  )

  const tileClass = `${panelClass} flex h-full min-h-[11.5rem] flex-col transition-[transform,box-shadow] ${
    isActive
      ? "hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--tg-theme-button-color)_12%,transparent)] active:scale-[0.98]"
      : "opacity-80"
  }`

  if (isActive && game.href) {
    return (
      <Link href={game.href} className={`${tileClass} no-underline text-inherit`}>
        {content}
      </Link>
    )
  }

  return <article className={tileClass}>{content}</article>
}
