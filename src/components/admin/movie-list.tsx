"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { BlurImage } from "@/components/blur-image"
import { ApiRequestError, api } from "@/lib/api-client"
import { ADMIN_MOVIES_PAGE_SIZE, copy } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { buttonClass, dangerActionClass, ghostButtonClass, linkActionClass, panelClass } from "@/lib/ui"
import type { MovieRecord } from "@/types/api"

type MoviesPage = {
  movies: MovieRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export function MovieList() {
  const { ready } = useTelegram()
  const [moviesPage, setMoviesPage] = useState<MoviesPage>({
    movies: [],
    total: 0,
    page: 1,
    pageSize: ADMIN_MOVIES_PAGE_SIZE,
    pageCount: 1,
  })
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const loadMovies = useCallback(async (nextPage: number) => {
    const data = await api<MoviesPage>(`/api/admin/movies?page=${nextPage}&pageSize=${ADMIN_MOVIES_PAGE_SIZE}`)
    setMoviesPage(data)
    setPage(data.page)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timeout = window.setTimeout(() => {
      void loadMovies(1).catch((caught: unknown) => {
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [ready, loadMovies])

  async function onDelete(movie: MovieRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${movie.title}?`)) return
    setPending(true)
    setError("")
    setMessage("")
    try {
      await api(`/api/admin/movies/${movie.id}`, { method: "DELETE" })
      setMessage(copy.admin.deleted)
      const nextPage = moviesPage.movies.length <= 1 && page > 1 ? page - 1 : page
      await loadMovies(nextPage)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setPending(false)
    }
  }

  return (
    <AdminFrame title={copy.admin.movies}>
      <Link href="/admin/movies/new" className={buttonClass}>
        {copy.admin.add}
      </Link>

      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <ul className="grid gap-3">
        {moviesPage.movies.length === 0 ? (
          <li className={`${panelClass} text-sm text-(--tg-theme-hint-color)`}>{copy.admin.emptyList}</li>
        ) : null}
        {moviesPage.movies.map((movie) => (
          <li key={movie.id} className={`${panelClass} flex gap-3 p-3`}>
            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)]">
              <BlurImage src={movie.posterUrl} alt={movie.title} blurhash={movie.posterBlurhash} sizes="64px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-tight">{movie.title}</p>
              <p className="mt-1 text-xs text-(--tg-theme-hint-color)">
                {movie.watchManyCount} / {movie.onceEnoughCount} / {movie.removeFromIndustryCount}
              </p>
              <div className="mt-3 flex gap-4">
                <Link href={`/admin/movies/${movie.id}/edit`} className={linkActionClass}>
                  {copy.admin.edit}
                </Link>
                <button type="button" className={dangerActionClass} disabled={pending} onClick={() => void onDelete(movie)}>
                  {copy.admin.delete}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {moviesPage.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className={ghostButtonClass}
            disabled={page <= 1 || pending}
            onClick={() => void loadMovies(page - 1)}
          >
            {copy.admin.prevPage}
          </button>
          <p className="text-sm text-(--tg-theme-hint-color)">
            {copy.admin.pageOf} {moviesPage.page} / {moviesPage.pageCount}
          </p>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={page >= moviesPage.pageCount || pending}
            onClick={() => void loadMovies(page + 1)}
          >
            {copy.admin.nextPage}
          </button>
        </div>
      ) : null}
    </AdminFrame>
  )
}
