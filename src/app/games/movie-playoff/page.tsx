"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { ErrorState } from "@/components/error-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { PlayoffBracketMini } from "@/components/playoff/playoff-bracket-mini"
import { PlayoffEmptyState } from "@/components/playoff/playoff-empty-state"
import { PlayoffPickPair } from "@/components/playoff/playoff-pick-pair"
import { BlurImage } from "@/components/blur-image"

import { ApiRequestError, api } from "@/lib/api-client"
import { copy, PLAYOFF_SIZE } from "@/lib/constants"
import { buttonClass, ghostButtonClass } from "@/lib/ui"
import { useTelegram } from "@/lib/telegram/use-telegram"
import type { PlayoffCurrentResponse, PlayoffFinishResponse, PlayoffTournamentResponse } from "@/types/api"

const ROUND_LABELS = ["1/16", "1/8", "1/4", "1/2", "Финал"] as const

function matchesInRound(roundIndex: number) {
  return PLAYOFF_SIZE / 2 / 2 ** roundIndex
}

function roundProgress(tournament: PlayoffTournamentResponse) {
  if (tournament.status !== "GAME") return null
  const total = matchesInRound(tournament.roundIndex)
  const done = tournament.bracket.matches.filter(
    (match) => match.roundIndex === tournament.roundIndex && match.winnerMovieId,
  ).length
  const label = ROUND_LABELS[tournament.roundIndex] ?? `R${tournament.roundIndex}`
  return `${label} · матч ${Math.min(done + 1, total)}/${total}`
}

export default function MoviePlayoffPage() {
  const router = useRouter()
  const { ready, isTelegram, haptic, backButton } = useTelegram()
  const [tournament, setTournament] = useState<PlayoffTournamentResponse | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading")
  const [available, setAvailable] = useState(0)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading")
    setError("")
    try {
      const data = await api<PlayoffCurrentResponse | { insufficient: true; available: number }>(
        "/api/games/movie-playoff/tournaments",
        { method: "POST", signal },
      )
      if (signal?.aborted) return
      if ("insufficient" in data && data.insufficient) {
        setAvailable(data.available)
        setTournament(null)
        setStatus("empty")
        return
      }
      setTournament((data as PlayoffCurrentResponse).tournament)
      setStatus("ready")
    } catch (caught) {
      if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return
      setStatus("error")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void load(controller.signal)
    }, 0)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [ready, load])

  useEffect(() => {
    if (!isTelegram) return
    const goHome = () => router.push("/")
    try {
      backButton.show()
      backButton.onClick(goHome)
    } catch {
      return
    }
    return () => {
      try {
        backButton.offClick(goHome)
        backButton.hide()
      } catch {
        // ignore
      }
    }
  }, [isTelegram, router, backButton])

  const onPick = useCallback(
    async (winnerMovieId: string) => {
      if (!tournament?.currentMatch || sending) return
      setSending(true)
      setError("")
      try {
        const data = await api<{ tournament: PlayoffTournamentResponse }>(
          `/api/games/movie-playoff/tournaments/${tournament.id}/pick`,
          {
            method: "PUT",
            body: JSON.stringify({
              matchId: tournament.currentMatch.id,
              winnerMovieId,
              version: tournament.version,
            }),
          },
        )
        haptic("success")
        setTournament(data.tournament)
      } catch (caught) {
        haptic("error")
        if (caught instanceof ApiRequestError && caught.status === 409) {
          setError(copy.playoffConflict)
          await load()
          return
        }
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      } finally {
        setSending(false)
      }
    },
    [tournament, sending, haptic, load],
  )

  const onFinish = useCallback(
    async (action: "home" | "restart") => {
      if (!tournament || sending) return
      setSending(true)
      setError("")
      try {
        const data = await api<PlayoffFinishResponse | { insufficient: true; available: number }>(
          `/api/games/movie-playoff/tournaments/${tournament.id}/finish`,
          {
            method: "POST",
            body: JSON.stringify({ action }),
          },
        )
        if ("insufficient" in data && data.insufficient) {
          setAvailable(data.available)
          setTournament(null)
          setStatus("empty")
          return
        }
        const finish = data as PlayoffFinishResponse
        haptic("success")
        if (finish.action === "home") {
          router.push("/")
          return
        }
        if (finish.tournament) {
          setTournament(finish.tournament)
        } else {
          await load()
        }
      } catch (caught) {
        haptic("error")
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      } finally {
        setSending(false)
      }
    },
    [tournament, sending, haptic, router, load],
  )

  const progress = useMemo(() => (tournament ? roundProgress(tournament) : null), [tournament])
  const current = tournament?.currentMatch
  const canPick = Boolean(current?.left && current?.right && !sending)

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 py-4">
      <header className="border-b border-(--surface-border) pb-3">
        <h1 className="text-xl font-semibold tracking-tight">{copy.playoffTitle}</h1>
        {progress ? <p className="mt-1 text-sm text-(--tg-theme-hint-color)">{progress}</p> : null}
      </header>

      {status === "loading" ? <LoadingSkeleton /> : null}
      {status === "error" ? <ErrorState message={error || copy.internal} onRetry={() => void load()} /> : null}
      {status === "empty" ? <PlayoffEmptyState available={available} /> : null}

      {status === "ready" && tournament?.status === "GAME" ? (
        current?.left && current?.right ? (
          <div className="grid gap-4">
            <PlayoffBracketMini bracket={tournament.bracket} currentMatch={current} />
            <p className="text-center text-sm text-(--tg-theme-hint-color)">{copy.playoffPick}</p>
            <PlayoffPickPair left={current.left} right={current.right} disabled={!canPick} onPick={(id) => void onPick(id)} />
            {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
          </div>
        ) : (
          <ErrorState message={copy.internal} onRetry={() => void load()} />
        )
      ) : null}

      {status === "ready" && tournament?.status === "PRE_END" && tournament.finalist ? (
        <div className="grid gap-4">
          <PlayoffBracketMini bracket={tournament.bracket} currentMatch={null} />
          <div className="mx-auto w-full max-w-55">
            <p className="mb-2 text-center text-sm font-medium text-(--tg-theme-hint-color)">{copy.playoffFinalist}</p>
            <article className="overflow-hidden rounded-sm border border-(--surface-border) bg-(--tg-theme-secondary-bg-color)">
              <div className="relative aspect-9/16">
                <BlurImage
                  src={tournament.finalist.posterUrl}
                  alt={tournament.finalist.title}
                  blurhash={tournament.finalist.posterBlurhash}
                  sizes="220px"
                />
              </div>
              <h2 className="px-3 py-3 text-center text-base font-semibold leading-snug">{tournament.finalist.title}</h2>
            </article>
          </div>
          <div className="grid gap-2">
            <button type="button" disabled={sending} className={buttonClass} onClick={() => void onFinish("restart")}>
              {copy.playoffNewGame}
            </button>
            <button type="button" disabled={sending} className={ghostButtonClass} onClick={() => void onFinish("home")}>
              {copy.playoffFinish}
            </button>
          </div>
          {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
        </div>
      ) : null}
    </main>
  )
}
