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
import type {
  PlayoffCurrentResponse,
  PlayoffFinishResponse,
  PlayoffHistoryItem,
  PlayoffHistoryResponse,
  PlayoffTournamentResponse,
} from "@/types/api"

const ROUND_LABELS = ["1/16", "1/8", "1/4", "1/2", "Финал"] as const

type PageStatus = "loading" | "playing" | "history" | "historyDetail" | "empty" | "error"

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

function formatPlayedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function MoviePlayoffPage() {
  const router = useRouter()
  const { ready, isTelegram, haptic, backButton } = useTelegram()
  const [tournament, setTournament] = useState<PlayoffTournamentResponse | null>(null)
  const [history, setHistory] = useState<PlayoffHistoryItem[]>([])
  const [status, setStatus] = useState<PageStatus>("loading")
  const [available, setAvailable] = useState(0)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    const data = await api<PlayoffHistoryResponse>("/api/games/movie-playoff/tournaments", { signal })
    if (signal?.aborted) return
    setHistory(data.tournaments)
    setTournament(null)
    setStatus("history")
  }, [])

  const bootstrap = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading")
      setError("")
      try {
        const data = await api<PlayoffCurrentResponse>("/api/games/movie-playoff/tournaments/current", { signal })
        if (signal?.aborted) return
        setTournament(data.tournament)
        setStatus("playing")
      } catch (caught) {
        if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return
        if (caught instanceof ApiRequestError && caught.status === 404) {
          try {
            await loadHistory(signal)
          } catch (historyError) {
            if (signal?.aborted || (historyError instanceof DOMException && historyError.name === "AbortError")) return
            setStatus("error")
            setError(historyError instanceof ApiRequestError ? historyError.message : copy.internal)
          }
          return
        }
        setStatus("error")
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      }
    },
    [loadHistory],
  )

  const startNewGame = useCallback(async () => {
    setSending(true)
    setError("")
    setStatus("loading")
    try {
      const data = await api<PlayoffCurrentResponse | { insufficient: true; available: number }>(
        "/api/games/movie-playoff/tournaments",
        { method: "POST" },
      )
      if ("insufficient" in data && data.insufficient) {
        setAvailable(data.available)
        setTournament(null)
        setStatus("empty")
        return
      }
      setTournament((data as PlayoffCurrentResponse).tournament)
      setStatus("playing")
    } catch (caught) {
      haptic("error")
      setStatus("error")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setSending(false)
    }
  }, [haptic])

  const openHistoryItem = useCallback(
    async (id: string) => {
      setSending(true)
      setError("")
      try {
        const data = await api<{ tournament: PlayoffTournamentResponse }>(`/api/games/movie-playoff/tournaments/${id}`)
        setTournament(data.tournament)
        setStatus("historyDetail")
      } catch (caught) {
        haptic("error")
        setStatus("history")
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      } finally {
        setSending(false)
      }
    },
    [haptic],
  )

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void bootstrap(controller.signal)
    }, 0)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [ready, bootstrap])

  useEffect(() => {
    if (!isTelegram) return

    const onBack = () => {
      if (status === "historyDetail") {
        setTournament(null)
        setStatus("history")
        return
      }
      router.push("/")
    }

    try {
      backButton.show()
      backButton.onClick(onBack)
    } catch {
      return
    }
    return () => {
      try {
        backButton.offClick(onBack)
        backButton.hide()
      } catch {
        // ignore
      }
    }
  }, [isTelegram, router, backButton, status])

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
          await bootstrap()
          return
        }
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      } finally {
        setSending(false)
      }
    },
    [tournament, sending, haptic, bootstrap],
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
          setStatus("loading")
          await loadHistory()
          return
        }
        if (finish.tournament) {
          setTournament(finish.tournament)
          setStatus("playing")
        } else {
          await bootstrap()
        }
      } catch (caught) {
        haptic("error")
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      } finally {
        setSending(false)
      }
    },
    [tournament, sending, haptic, loadHistory, bootstrap],
  )

  const progress = useMemo(() => (tournament && status === "playing" ? roundProgress(tournament) : null), [tournament, status])
  const current = tournament?.currentMatch
  const canPick = Boolean(current?.left && current?.right && !sending)

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 py-4">
      <header className="border-b border-(--surface-border) pb-3">
        <h1 className="text-xl font-semibold tracking-tight">{copy.playoffTitle}</h1>
        {progress ? <p className="mt-1 text-sm text-(--tg-theme-hint-color)">{progress}</p> : null}
      </header>

      {status === "loading" ? <LoadingSkeleton /> : null}
      {status === "error" ? (
        <ErrorState
          message={error || copy.internal}
          onRetry={() => {
            void bootstrap()
          }}
        />
      ) : null}
      {status === "empty" ? <PlayoffEmptyState available={available} /> : null}

      {status === "history" ? (
        <div className="grid gap-4">
          <button type="button" disabled={sending} className={buttonClass} onClick={() => void startNewGame()}>
            {copy.playoffPlayNew}
          </button>
          {history.length === 0 ? (
            <p className="text-center text-sm text-(--tg-theme-hint-color)">{copy.playoffHistoryEmpty}</p>
          ) : (
            <ul className="grid gap-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={sending}
                    className="flex w-full items-center gap-3 border border-(--surface-border) bg-(--tg-theme-secondary-bg-color) px-3 py-2 text-left disabled:opacity-60"
                    onClick={() => void openHistoryItem(item.id)}
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden bg-(--tg-theme-bg-color)">
                      {item.finalist ? (
                        <BlurImage
                          src={item.finalist.posterUrl}
                          alt={item.finalist.title}
                          blurhash={item.finalist.posterBlurhash}
                          sizes="40px"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.finalist?.title ?? copy.playoffFinalist}</p>
                      <p className="mt-0.5 text-xs text-(--tg-theme-hint-color)">{formatPlayedAt(item.createdAt)}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
        </div>
      ) : null}

      {status === "historyDetail" && tournament ? (
        <div className="grid gap-4">
          <PlayoffBracketMini bracket={tournament.bracket} currentMatch={null} />
          {tournament.finalist ? (
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
          ) : null}
          <button
            type="button"
            disabled={sending}
            className={ghostButtonClass}
            onClick={() => {
              setTournament(null)
              setStatus("history")
            }}
          >
            {copy.playoffBackToList}
          </button>
        </div>
      ) : null}

      {status === "playing" && tournament?.status === "GAME" ? (
        current?.left && current?.right ? (
          <div className="grid gap-4">
            <PlayoffBracketMini bracket={tournament.bracket} currentMatch={current} />
            <p className="text-center text-sm text-(--tg-theme-hint-color)">{copy.playoffPick}</p>
            <PlayoffPickPair left={current.left} right={current.right} disabled={!canPick} onPick={(id) => void onPick(id)} />
            {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
          </div>
        ) : (
          <ErrorState message={copy.internal} onRetry={() => void bootstrap()} />
        )
      ) : null}

      {status === "playing" && tournament?.status === "PRE_END" && tournament.finalist ? (
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
