"use client"

import { BlurImage } from "@/components/blur-image"
import type { PlayoffBracket, PlayoffMatchView, PlayoffMovieRef } from "@/types/api"

type SlotState = "empty" | "hidden" | "alive" | "eliminated" | "active"

type BracketMatch = PlayoffBracket["matches"][number]

function movieById(bracket: PlayoffBracket) {
  return new Map(bracket.movies.map((movie) => [movie.id, movie]))
}

function matchesInRound(roundIndex: number, size: number) {
  return size / 2 / 2 ** roundIndex
}

function slotState(
  movieId: string | null,
  match: BracketMatch,
  currentMatch: PlayoffMatchView | null,
): SlotState {
  if (!movieId) return "empty"

  const isCurrent = currentMatch?.id === match.id
  const decided = Boolean(match.winnerMovieId)

  if (isCurrent && !decided) return "active"
  if (decided && match.winnerMovieId !== movieId) return "eliminated"
  if (decided) return "alive"
  // Победитель прошлого раунда уже в узле — показываем цветным; сиды ждут своего матча
  if (match.roundIndex > 0) return "alive"
  return "hidden"
}

function BracketSlot({
  movie,
  state,
  accent,
}: {
  movie: PlayoffMovieRef | null
  state: SlotState
  accent: "left" | "right" | "final"
}) {
  const accentClass =
    accent === "left"
      ? "border-[color-mix(in_srgb,var(--choice-remove)_55%,transparent)]"
      : accent === "right"
        ? "border-[color-mix(in_srgb,var(--choice-once)_55%,transparent)]"
        : "border-[color-mix(in_srgb,var(--tg-theme-button-color)_70%,transparent)]"

  const ring =
    state === "active" ? "ring-1 ring-(--tg-theme-button-color)" : state === "alive" ? "ring-1 ring-transparent" : ""

  return (
    <div
      className={`relative h-4.5 w-3 shrink-0 overflow-hidden rounded-[1px] border bg-(--tg-theme-secondary-bg-color) ${accentClass} ${ring} ${
        state === "eliminated" ? "grayscale opacity-70" : ""
      } ${state === "empty" ? "border-(--surface-border) bg-(--tg-theme-bg-color)" : ""}`}
      title={movie && state !== "hidden" && state !== "empty" ? movie.title : undefined}
    >
      {movie && state !== "empty" ? (
        <>
          <BlurImage
            src={movie.posterUrl}
            alt={state === "hidden" ? "" : movie.title}
            blurhash={movie.posterBlurhash}
            sizes="12px"
          />
          {state === "hidden" ? (
            <div className="absolute inset-0 bg-(--tg-theme-bg-color)/60 backdrop-blur-[3px]" aria-hidden />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function MatchNode({
  match,
  movies,
  currentMatch,
  accent,
  connector,
}: {
  match: BracketMatch
  movies: Map<string, PlayoffMovieRef>
  currentMatch: PlayoffMatchView | null
  accent: "left" | "right" | "final"
  connector: "left" | "right" | "none"
}) {
  const left = match.leftMovieId ? (movies.get(match.leftMovieId) ?? null) : null
  const right = match.rightMovieId ? (movies.get(match.rightMovieId) ?? null) : null
  const lineColor =
    accent === "left"
      ? "border-[color-mix(in_srgb,var(--choice-remove)_65%,transparent)]"
      : accent === "right"
        ? "border-[color-mix(in_srgb,var(--choice-once)_65%,transparent)]"
        : "border-(--surface-border-strong)"

  return (
    <div className="relative flex items-center">
      {connector === "right" ? (
        <div className={`mr-0.5 h-5.5 w-1.5 rounded-l-[1px] border-y border-l ${lineColor}`} aria-hidden />
      ) : null}
      <div
        className={`flex flex-col gap-0.5 rounded-xs border px-0.5 py-0.5 ${
          currentMatch?.id === match.id
            ? "border-(--tg-theme-button-color) bg-[color-mix(in_srgb,var(--tg-theme-button-color)_10%,transparent)]"
            : "border-transparent"
        }`}
      >
        <BracketSlot movie={left} state={slotState(match.leftMovieId, match, currentMatch)} accent={accent} />
        <BracketSlot movie={right} state={slotState(match.rightMovieId, match, currentMatch)} accent={accent} />
      </div>
      {connector === "left" ? (
        <div className={`ml-0.5 h-5.5 w-1.5 rounded-r-[1px] border-y border-r ${lineColor}`} aria-hidden />
      ) : null}
    </div>
  )
}

function RoundColumn({
  matches,
  movies,
  currentMatch,
  accent,
  connector,
}: {
  matches: BracketMatch[]
  movies: Map<string, PlayoffMovieRef>
  currentMatch: PlayoffMatchView | null
  accent: "left" | "right" | "final"
  connector: "left" | "right" | "none"
}) {
  return (
    <div className="flex flex-col justify-around gap-0.5 self-stretch py-0.5">
      {matches.map((match) => (
        <MatchNode
          key={match.id}
          match={match}
          movies={movies}
          currentMatch={currentMatch}
          accent={accent}
          connector={connector}
        />
      ))}
    </div>
  )
}

function ChampionSlot({
  movie,
  revealed,
}: {
  movie: PlayoffMovieRef | null
  revealed: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-(--tg-theme-button-color)">Playoffs</span>
      <div
        className={`relative h-7 w-5 overflow-hidden rounded-xs border-2 border-(--tg-theme-button-color) bg-(--tg-theme-secondary-bg-color) ${
          revealed && movie ? "" : "opacity-80"
        }`}
        title={revealed && movie ? movie.title : undefined}
      >
        {movie && revealed ? (
          <BlurImage src={movie.posterUrl} alt={movie.title} blurhash={movie.posterBlurhash} sizes="20px" />
        ) : (
          <div className="absolute inset-0 bg-(--tg-theme-bg-color)/40" aria-hidden />
        )}
      </div>
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
  const movies = movieById(bracket)
  const finalRound = Math.log2(bracket.size) - 1
  const rounds = Array.from({ length: finalRound }, (_, roundIndex) => {
    const all = bracket.matches
      .filter((match) => match.roundIndex === roundIndex)
      .sort((a, b) => a.slot - b.slot)
    const half = matchesInRound(roundIndex, bracket.size) / 2
    return {
      roundIndex,
      left: all.slice(0, half),
      right: all.slice(half),
    }
  })

  const finalMatch = bracket.matches.find((match) => match.roundIndex === finalRound) ?? null
  const championId = finalMatch?.winnerMovieId ?? null
  const champion = championId ? (movies.get(championId) ?? null) : null

  return (
    <div className="overflow-x-auto rounded-sm border border-(--surface-border) bg-(--tg-theme-secondary-bg-color) p-2">
      <div className="mx-auto flex min-h-80 min-w-85 items-stretch justify-center gap-0.5">
        {rounds.map((round) => (
          <RoundColumn
            key={`L-${round.roundIndex}`}
            matches={round.left}
            movies={movies}
            currentMatch={currentMatch}
            accent="left"
            connector="left"
          />
        ))}

        <div className="flex flex-col items-center justify-center gap-2 px-1">
          <ChampionSlot movie={champion} revealed={Boolean(champion)} />
          {finalMatch ? (
            <MatchNode
              match={finalMatch}
              movies={movies}
              currentMatch={currentMatch}
              accent="final"
              connector="none"
            />
          ) : null}
        </div>

        {[...rounds].reverse().map((round) => (
          <RoundColumn
            key={`R-${round.roundIndex}`}
            matches={round.right}
            movies={movies}
            currentMatch={currentMatch}
            accent="right"
            connector="right"
          />
        ))}
      </div>
    </div>
  )
}
