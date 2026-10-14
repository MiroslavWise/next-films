"use client"

import { BlurImage } from "@/components/blur-image"
import type { PlayoffBracket, PlayoffMatchView, PlayoffMovieRef } from "@/types/api"

type PosterState = "hidden" | "alive" | "eliminated"

function posterState(
  movieId: string,
  matches: PlayoffBracket["matches"],
  currentMatch: PlayoffMatchView | null,
): PosterState {
  let seen = false
  let eliminated = false

  for (const match of matches) {
    const inMatch = match.leftMovieId === movieId || match.rightMovieId === movieId
    if (!inMatch) continue

    const isCurrent = currentMatch?.id === match.id
    const decided = Boolean(match.winnerMovieId)
    if (!decided && !isCurrent) continue

    seen = true
    if (decided && match.winnerMovieId !== movieId) eliminated = true
  }

  if (!seen) return "hidden"
  if (eliminated) return "eliminated"
  return "alive"
}

function MiniPoster({
  movie,
  state,
}: {
  movie: PlayoffMovieRef
  state: PosterState
}) {
  return (
    <div
      className={`relative aspect-9/16 overflow-hidden rounded-xs bg-(--tg-theme-secondary-bg-color) ${
        state === "eliminated" ? "grayscale" : ""
      }`}
      title={state === "hidden" ? undefined : movie.title}
    >
      <BlurImage src={movie.posterUrl} alt={state === "hidden" ? "" : movie.title} blurhash={movie.posterBlurhash} sizes="40px" />
      {state === "hidden" ? (
        <div className="absolute inset-0 bg-(--tg-theme-bg-color)/55 backdrop-blur-[6px]" aria-hidden />
      ) : null}
    </div>
  )
}

export function PlayoffBracketMini({
  bracket,
  currentMatch,
}: {
  bracket: PlayoffBracket
  currentMatch: PlayoffMatchView | null
}) {
  const byId = new Map(bracket.movies.map((movie) => [movie.id, movie]))

  return (
    <div className="grid grid-cols-8 gap-1 rounded-sm border border-(--surface-border) bg-(--tg-theme-secondary-bg-color) p-1.5">
      {bracket.seedMovieIds.map((movieId) => {
        const movie = byId.get(movieId)
        if (!movie) return <div key={movieId} className="aspect-9/16 rounded-xs bg-(--surface-border)" />
        return <MiniPoster key={movieId} movie={movie} state={posterState(movieId, bracket.matches, currentMatch)} />
      })}
    </div>
  )
}
