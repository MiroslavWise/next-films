"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { MovieCard } from "@/components/movie-card"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"

import { copy } from "@/lib/constants"
import { ApiRequestError, api } from "@/lib/api-client"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { useSessionStore } from "@/lib/store/session"
import type { RoundMovie, RoundResponse, VoteChoiceName, VoteResponse } from "@/types/api"

export default function MovieChoicePage() {
  const router = useRouter()
  const { ready, isTelegram, haptic, mainButton, backButton } = useTelegram()
  const choices = useSessionStore((state) => state.choices)
  const setChoice = useSessionStore((state) => state.setChoice)
  const clearChoices = useSessionStore((state) => state.clearChoices)
  const [movies, setMovies] = useState<RoundMovie[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "finished" | "error">("loading")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [choiceHint, setChoiceHint] = useState("")

  const selectedChoices = useMemo(
    () => movies.map((movie) => choices[movie.id]).filter(Boolean) as VoteChoiceName[],
    [movies, choices],
  )
  const hasDuplicateChoice = selectedChoices.length !== new Set(selectedChoices).size
  const allChosen = movies.length > 0 && movies.every((movie) => Boolean(choices[movie.id]))
  const canSubmit = allChosen && !hasDuplicateChoice

  const load = useCallback(
    async (signal: AbortSignal) => {
      setStatus("loading")
      setSaved(false)
      try {
        const round = await api<RoundResponse>("/api/games/movie-choice/round", { signal })
        if (signal.aborted) return
        setMovies(round.movies)
        clearChoices()
        setChoiceHint("")
        setError("")
        setStatus(round.finished ? "finished" : "ready")
      } catch (caught) {
        if (signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return
        setStatus("error")
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      }
    },
    [clearChoices],
  )

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

  const submit = useCallback(async () => {
    if (!canSubmit || sending) return
    setSending(true)
    setError("")
    try {
      mainButton.showLoader()
    } catch {
      // ignore outside Telegram
    }
    try {
      const result = await api<VoteResponse>("/api/games/movie-choice/vote", {
        method: "POST",
        body: JSON.stringify({
          votes: movies.map((movie) => ({ movieId: movie.id, choice: choices[movie.id] })),
        }),
      })
      haptic("success")
      setSaved(true)
      setChoiceHint("")
      window.setTimeout(() => {
        setMovies(result.next.movies)
        clearChoices()
        setSaved(false)
        setStatus(result.next.finished ? "finished" : "ready")
      }, 700)
    } catch (caught) {
      haptic("error")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setSending(false)
      try {
        mainButton.hideLoader()
      } catch {
        // ignore
      }
    }
  }, [canSubmit, sending, movies, choices, haptic, mainButton, clearChoices])

  const submitRef = useRef(submit)
  submitRef.current = submit

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

  // Показать MainButton один раз на раунд; не hide/show при каждом выборе — иначе «прыгает».
  useEffect(() => {
    if (!isTelegram || status !== "ready") {
      try {
        mainButton.hide()
      } catch {
        // ignore
      }
      return
    }

    const onClick = () => {
      void submitRef.current()
    }

    try {
      mainButton.setText(copy.confirm)
      mainButton.disable()
      mainButton.show()
      mainButton.onClick(onClick)
    } catch {
      return
    }

    return () => {
      try {
        mainButton.offClick(onClick)
        mainButton.hide()
      } catch {
        // ignore
      }
    }
  }, [isTelegram, status, mainButton])

  useEffect(() => {
    if (!isTelegram || status !== "ready") return
    try {
      mainButton.setText(sending ? copy.sending : copy.confirm)
      if (canSubmit && !sending) mainButton.enable()
      else mainButton.disable()
    } catch {
      // ignore
    }
  }, [isTelegram, status, canSubmit, sending, mainButton])

  const statusText = useMemo(() => {
    if (sending) return copy.sending
    if (saved) return copy.saved
    return ""
  }, [sending, saved])

  function onMovieChoice(movieId: string, choice: VoteChoiceName) {
    const takenByOther = movies.some((movie) => movie.id !== movieId && choices[movie.id] === choice)
    if (takenByOther) {
      setChoiceHint(copy.duplicateChoice)
      haptic("error")
      return
    }
    setChoiceHint("")
    setChoice(movieId, choice)
  }

  const warningText = hasDuplicateChoice || choiceHint ? copy.duplicateChoice : ""

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-3 py-4">
      <header className="border-b border-(--surface-border) pb-3">
        <h1 className="text-xl font-semibold tracking-tight">{copy.appTitle}</h1>
      </header>
      {status === "loading" ? <LoadingSkeleton /> : null}
      {status === "error" ? (
        <ErrorState message={error || copy.internal} onRetry={() => void load(new AbortController().signal)} />
      ) : null}
      {status === "finished" ? <EmptyState /> : null}
      {status === "ready" ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                choice={choices[movie.id] as VoteChoiceName | undefined}
                takenChoices={selectedChoices}
                disabled={sending}
                onChoice={(choice) => onMovieChoice(movie.id, choice)}
              />
            ))}
          </div>
          {statusText ? <p className="text-center text-sm text-(--tg-theme-hint-color)">{statusText}</p> : null}
          {error ? <p className="text-center text-sm text-(--danger)">{error}</p> : null}
          {warningText ? <p className="text-center text-sm text-(--danger)">{warningText}</p> : null}
          {!isTelegram ? (
            <button
              type="button"
              disabled={!canSubmit || sending}
              onClick={() => void submit()}
              className="h-12 rounded-[var(--radius-sm)] bg-(--tg-theme-button-color) text-sm font-semibold text-(--tg-theme-button-text-color) transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {sending ? copy.sending : copy.confirm}
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
