"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { BlurImage } from "@/components/blur-image"
import { ErrorState } from "@/components/error-state"
import { FrameRevealGrid } from "@/components/frame-reveal/frame-reveal-grid"
import { LoadingSkeleton } from "@/components/loading-skeleton"

import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { buttonClass, ghostButtonClass } from "@/lib/ui"
import { useTelegram } from "@/lib/telegram/use-telegram"
import type {
  FrameRevealAnswerResponse,
  FrameRevealCurrentResponse,
  FrameRevealFinishResponse,
  FrameRevealHistoryItem,
  FrameRevealHistoryResponse,
  FrameRevealInsufficientResponse,
  FrameRevealRevealResponse,
  FrameRevealRoundAnswered,
  FrameRevealRoundPublic,
  FrameRevealSessionDetailResponse,
  FrameRevealSessionResponse,
} from "@/types/api"

type PageStatus = "loading" | "playing" | "feedback" | "history" | "historyDetail" | "empty" | "error"

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

function scoreLabel(correct: number, answered: number) {
  return `${copy.frameRevealScore}: ${correct}/${answered}`
}

export default function FrameRevealPage() {
  const router = useRouter()
  const { ready, isTelegram, haptic, backButton } = useTelegram()
  const [session, setSession] = useState<FrameRevealSessionResponse | null>(null)
  const [round, setRound] = useState<FrameRevealRoundPublic | null>(null)
  const [feedback, setFeedback] = useState<FrameRevealRoundAnswered | null>(null)
  const [history, setHistory] = useState<FrameRevealHistoryItem[]>([])
  const [detailRounds, setDetailRounds] = useState<FrameRevealRoundAnswered[]>([])
  const [status, setStatus] = useState<PageStatus>("loading")
  const [entries, setEntries] = useState(0)
  const [movies, setMovies] = useState(0)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current != null) window.clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const showInsufficient = useCallback((data: FrameRevealInsufficientResponse) => {
    setEntries(data.entries)
    setMovies(data.movies)
    setSession(null)
    setRound(null)
    setFeedback(null)
    setStatus("empty")
  }, [])

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    const data = await api<FrameRevealHistoryResponse>("/api/games/frame-reveal/sessions", { signal })
    if (signal?.aborted) return
    setHistory(data.sessions)
    setSession(null)
    setRound(null)
    setFeedback(null)
    setDetailRounds([])
    setStatus("history")
  }, [])

  const applySession = useCallback((next: FrameRevealSessionResponse) => {
    setSession(next)
    setRound(next.currentRound)
    setFeedback(null)
    setStatus(next.currentRound ? "playing" : "error")
    if (!next.currentRound) setError(copy.frameRevealEmptyText)
  }, [])

  const bootstrap = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading")
      setError("")
      try {
        const data = await api<FrameRevealCurrentResponse | FrameRevealInsufficientResponse>(
          "/api/games/frame-reveal/sessions/current",
          { signal },
        )
        if (signal?.aborted) return
        if ("insufficient" in data && data.insufficient) {
          showInsufficient(data)
          return
        }
        applySession((data as FrameRevealCurrentResponse).session)
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
    [applySession, loadHistory, showInsufficient],
  )

  const startNewGame = useCallback(async () => {
    setSending(true)
    setError("")
    setStatus("loading")
    try {
      const data = await api<FrameRevealCurrentResponse | FrameRevealInsufficientResponse>(
        "/api/games/frame-reveal/sessions",
        { method: "POST" },
      )
      if ("insufficient" in data && data.insufficient) {
        showInsufficient(data)
        return
      }
      applySession((data as FrameRevealCurrentResponse).session)
    } catch (caught) {
      haptic("error")
      setStatus("error")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setSending(false)
    }
  }, [applySession, haptic, showInsufficient])

  const openHistoryItem = useCallback(
    async (id: string) => {
      setSending(true)
      setError("")
      try {
        const data = await api<FrameRevealSessionDetailResponse>(`/api/games/frame-reveal/sessions/${id}`)
        setSession(data.session)
        setDetailRounds(data.session.rounds)
        setRound(null)
        setFeedback(null)
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
        setSession(null)
        setDetailRounds([])
        setStatus("history")
        return
      }
      if (status === "playing" || status === "feedback") {
        void loadHistory()
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
  }, [isTelegram, router, backButton, status, loadHistory])

  const onReveal = useCallback(async () => {
    if (!round || sending || status !== "playing" || !round.canRevealMore) return
    setSending(true)
    setError("")
    try {
      const data = await api<FrameRevealRevealResponse>(`/api/games/frame-reveal/rounds/${round.id}/reveal`, {
        method: "POST",
      })
      haptic("success")
      setRound(data.round)
    } catch (caught) {
      haptic("error")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setSending(false)
    }
  }, [round, sending, status, haptic])

  const onAnswer = useCallback(
    async (movieId: string) => {
      if (!round || sending || status !== "playing") return
      setSending(true)
      setError("")
      try {
        const data = await api<FrameRevealAnswerResponse>(`/api/games/frame-reveal/rounds/${round.id}/answer`, {
          method: "POST",
          body: JSON.stringify({ movieId }),
        })
        haptic(data.answered.isCorrect ? "success" : "error")
        setSession(data.session)
        setFeedback(data.answered)
        setStatus("feedback")

        if (feedbackTimerRef.current != null) window.clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = window.setTimeout(() => {
          if (data.nextRound) {
            setRound(data.nextRound)
            setFeedback(null)
            setStatus("playing")
          } else if (data.insufficientNext) {
            setRound(null)
            setFeedback(null)
            setError(copy.frameRevealEmptyText)
            setStatus("error")
          }
        }, 1200)
      } catch (caught) {
        haptic("error")
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      } finally {
        setSending(false)
      }
    },
    [round, sending, status, haptic],
  )

  const onFinish = useCallback(
    async (action: "home" | "restart") => {
      if (!session || sending) return
      setSending(true)
      setError("")
      try {
        const data = await api<FrameRevealFinishResponse | FrameRevealInsufficientResponse>(
          `/api/games/frame-reveal/sessions/${session.id}/finish`,
          {
            method: "POST",
            body: JSON.stringify({ action }),
          },
        )
        if ("insufficient" in data && data.insufficient) {
          showInsufficient(data)
          return
        }
        const finish = data as FrameRevealFinishResponse
        haptic("success")
        if (finish.action === "home") {
          await loadHistory()
          return
        }
        if (finish.session) {
          applySession(finish.session)
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
    [session, sending, haptic, loadHistory, applySession, bootstrap, showInsufficient],
  )

  const progress =
    session && (status === "playing" || status === "feedback")
      ? scoreLabel(session.correctCount, session.answeredCount)
      : null

  const shownRound = status === "feedback" && feedback ? feedback : round

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 py-4">
      <header className="border-b border-(--surface-border) pb-3">
        <h1 className="text-xl font-semibold tracking-tight">{copy.frameRevealTitle}</h1>
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

      {status === "empty" ? (
        <div className="grid gap-3 rounded-sm border border-(--surface-border) bg-(--tg-theme-secondary-bg-color) p-4 text-center">
          <p className="text-sm font-medium">{copy.emptyTitle}</p>
          <p className="text-sm text-(--tg-theme-hint-color)">{copy.frameRevealEmptyText}</p>
          <p className="text-xs text-(--tg-theme-hint-color)">
            Кадры: {entries} · Фильмы: {movies}
          </p>
        </div>
      ) : null}

      {status === "history" ? (
        <div className="grid gap-4">
          <button type="button" disabled={sending} className={buttonClass} onClick={() => void startNewGame()}>
            {copy.frameRevealPlayNew}
          </button>
          {history.length === 0 ? (
            <p className="text-center text-sm text-(--tg-theme-hint-color)">{copy.frameRevealHistoryEmpty}</p>
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
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden bg-(--tg-theme-bg-color)">
                      {item.preview ? (
                        <BlurImage
                          src={item.preview.imageUrl}
                          alt=""
                          blurhash={item.preview.imageBlurhash}
                          sizes="80px"
                          orientation="landscape"
                          objectFit="cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{scoreLabel(item.correctCount, item.answeredCount)}</p>
                      <p className="mt-0.5 text-xs text-(--tg-theme-hint-color)">
                        {formatPlayedAt(item.endedAt ?? item.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
        </div>
      ) : null}

      {status === "historyDetail" && session ? (
        <div className="grid gap-4">
          <p className="text-center text-sm font-medium">{scoreLabel(session.correctCount, session.answeredCount)}</p>
          <ul className="grid gap-4">
            {detailRounds.map((item) => (
              <li key={item.id} className="grid gap-2">
                <FrameRevealGrid
                  imageUrl={item.imageUrl}
                  imageBlurhash={item.imageBlurhash}
                  cols={item.cols}
                  rows={item.rows}
                  openedCells={item.openedCells}
                  alt={item.correctTitle}
                  dimClosed
                />
                <div className="grid gap-1 px-1">
                  <p className={`text-sm font-medium ${item.isCorrect ? "text-(--success)" : "text-(--danger)"}`}>
                    {item.isCorrect ? copy.frameRevealCorrect : copy.frameRevealWrong}
                  </p>
                  <p className="text-sm">{item.correctTitle}</p>
                  <p className="text-xs text-(--tg-theme-hint-color)">
                    {copy.frameRevealOpened}: {item.openedCells.length}/{item.cols * item.rows} · {copy.frameRevealMore}:{" "}
                    {item.revealCount}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={sending}
            className={ghostButtonClass}
            onClick={() => {
              setSession(null)
              setDetailRounds([])
              setStatus("history")
            }}
          >
            {copy.frameRevealBackToList}
          </button>
        </div>
      ) : null}

      {(status === "playing" || status === "feedback") && shownRound ? (
        <div className="grid gap-4">
          <FrameRevealGrid
            imageUrl={shownRound.imageUrl}
            imageBlurhash={shownRound.imageBlurhash}
            cols={shownRound.cols}
            rows={shownRound.rows}
            openedCells={shownRound.openedCells}
            alt={copy.frameRevealTitle}
          />

          <p className="text-center text-xs text-(--tg-theme-hint-color)">
            {copy.frameRevealOpened}: {shownRound.openedCells.length}/{shownRound.cols * shownRound.rows}
          </p>

          {status === "feedback" && feedback ? (
            <p
              className={`text-center text-sm font-semibold ${feedback.isCorrect ? "text-(--success)" : "text-(--danger)"}`}
            >
              {feedback.isCorrect ? copy.frameRevealCorrect : `${copy.frameRevealWrong}: ${feedback.correctTitle}`}
            </p>
          ) : (
            <p className="text-center text-sm text-(--tg-theme-hint-color)">{copy.frameRevealPick}</p>
          )}

          {status === "playing" ? (
            <button
              type="button"
              disabled={sending || !shownRound.canRevealMore}
              className={ghostButtonClass}
              onClick={() => void onReveal()}
            >
              {copy.frameRevealMore}
            </button>
          ) : null}

          <div className="grid gap-2">
            {shownRound.options.map((option) => {
              const isChosen = feedback?.chosenMovieId === option.movieId
              const isCorrectOption = feedback?.correctMovieId === option.movieId
              const highlight =
                status === "feedback"
                  ? isCorrectOption
                    ? "border-(--success) bg-[color-mix(in_srgb,var(--success)_14%,transparent)]"
                    : isChosen
                      ? "border-(--danger) bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]"
                      : "border-(--surface-border) opacity-60"
                  : "border-(--surface-border) bg-(--tg-theme-secondary-bg-color)"

              return (
                <button
                  key={option.movieId}
                  type="button"
                  disabled={sending || status === "feedback"}
                  className={`rounded-sm border px-3 py-3 text-left text-sm font-medium transition-transform active:scale-[0.99] disabled:opacity-80 ${highlight}`}
                  onClick={() => void onAnswer(option.movieId)}
                >
                  {option.title}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            disabled={sending || status === "feedback"}
            className={ghostButtonClass}
            onClick={() => void onFinish("home")}
          >
            {copy.frameRevealFinish}
          </button>
          {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
        </div>
      ) : null}
    </main>
  )
}
