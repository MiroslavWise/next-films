"use client"

import { BlurImage } from "@/components/blur-image"
import type { PlayoffMovieRef } from "@/types/api"

function PickCard({ movie, disabled, onPick }: { movie: PlayoffMovieRef; disabled: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="group flex min-w-0 flex-col overflow-hidden rounded-sm border border-(--surface-border) bg-(--tg-theme-secondary-bg-color) text-left transition-transform active:scale-[0.98] disabled:opacity-50"
      aria-label={movie.title}
    >
      <div className="relative aspect-9/16">
        <BlurImage src={movie.posterUrl} alt={movie.title} blurhash={movie.posterBlurhash} sizes="50vw" />
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
      </div>
      <span className="line-clamp-2 px-2 py-2 text-center text-xs font-medium leading-snug">{movie.title}</span>
    </button>
  )
}

export function PlayoffPickPair({
  left,
  right,
  disabled,
  onPick,
}: {
  left: PlayoffMovieRef
  right: PlayoffMovieRef
  disabled: boolean
  onPick: (winnerMovieId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <PickCard movie={left} disabled={disabled} onPick={() => onPick(left.id)} />
      <PickCard movie={right} disabled={disabled} onPick={() => onPick(right.id)} />
    </div>
  )
}
