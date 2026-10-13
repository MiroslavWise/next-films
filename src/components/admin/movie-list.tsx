"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { MovieListSkeleton } from "@/components/admin/admin-skeletons"
import { BlurImage } from "@/components/blur-image"
import { VoteCounts } from "@/components/vote-counts"
import { adminKeys, useMoviesPageQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { buttonClass, dangerActionClass, ghostButtonClass, linkActionClass, panelClass } from "@/lib/ui"
import type { MovieRecord } from "@/types/api"

export function MovieList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const moviesQuery = useMoviesPageQuery(page)

  const deleteMutation = useMutation({
    mutationFn: (movie: MovieRecord) => api(`/api/admin/movies/${movie.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.movies() })
    },
  })

  async function onDelete(movie: MovieRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${movie.title}?`)) return
    setError("")
    setMessage("")
    try {
      await deleteMutation.mutateAsync(movie)
      setMessage(copy.admin.deleted)
      const remaining = moviesQuery.data?.movies.length ?? 0
      if (remaining <= 1 && page > 1) setPage((value) => value - 1)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const moviesPage = moviesQuery.data
  const loadError = moviesQuery.isError
    ? moviesQuery.error instanceof ApiRequestError
      ? moviesQuery.error.message
      : copy.internal
    : ""

  return (
    <AdminFrame title={copy.admin.movies}>
      <Link href="/admin/movies/new" className={buttonClass}>
        {copy.admin.add}
      </Link>

      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}

      {moviesQuery.isPending ? <MovieListSkeleton /> : null}

      {moviesPage ? (
        <>
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
                  <VoteCounts
                    many={movie.watchManyCount}
                    once={movie.onceEnoughCount}
                    remove={movie.removeFromIndustryCount}
                  />
                  <div className="mt-3 flex gap-4">
                    <Link href={`/admin/movies/${movie.id}/edit`} className={linkActionClass}>
                      {copy.admin.edit}
                    </Link>
                    <button
                      type="button"
                      className={dangerActionClass}
                      disabled={deleteMutation.isPending}
                      onClick={() => void onDelete(movie)}
                    >
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
                disabled={page <= 1 || deleteMutation.isPending}
                onClick={() => setPage((value) => value - 1)}
              >
                {copy.admin.prevPage}
              </button>
              <p className="text-sm text-(--tg-theme-hint-color)">
                {copy.admin.pageOf} {moviesPage.page} / {moviesPage.pageCount}
              </p>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={page >= moviesPage.pageCount || deleteMutation.isPending}
                onClick={() => setPage((value) => value + 1)}
              >
                {copy.admin.nextPage}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminFrame>
  )
}
