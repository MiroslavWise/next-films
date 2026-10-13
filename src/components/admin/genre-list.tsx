"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { RowsListSkeleton } from "@/components/admin/admin-skeletons"
import { adminKeys, useGenresQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { buttonClass, dangerActionClass, linkActionClass, panelClass } from "@/lib/ui"
import type { NamedRef } from "@/types/api"

export function GenreList() {
  const queryClient = useQueryClient()
  const genresQuery = useGenresQuery()
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const deleteMutation = useMutation({
    mutationFn: (genre: NamedRef) => api(`/api/admin/genres/${genre.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.genres() })
    },
  })

  async function onDelete(genre: NamedRef) {
    if (!window.confirm(`${copy.admin.delete}: ${genre.name}?`)) return
    setError("")
    setMessage("")
    try {
      await deleteMutation.mutateAsync(genre)
      setMessage(copy.admin.deleted)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const genres = genresQuery.data ?? []
  const loadError = genresQuery.isError
    ? genresQuery.error instanceof ApiRequestError
      ? genresQuery.error.message
      : copy.internal
    : ""

  return (
    <AdminFrame title={copy.admin.genres}>
      <Link href="/admin/genres/new" className={buttonClass}>
        {copy.admin.add}
      </Link>

      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}
      {genresQuery.isPending ? <RowsListSkeleton /> : null}

      {!genresQuery.isPending ? (
        <ul className={`${panelClass} divide-y divide-(--surface-border) p-0`}>
          {genres.length === 0 ? (
            <li className="px-4 py-3 text-sm text-(--tg-theme-hint-color)">{copy.admin.emptyList}</li>
          ) : null}
          {genres.map((genre) => (
            <li key={genre.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">{genre.name}</span>
              <span className="flex gap-4">
                <Link href={`/admin/genres/${genre.id}/edit`} className={linkActionClass}>
                  {copy.admin.edit}
                </Link>
                <button
                  type="button"
                  className={dangerActionClass}
                  disabled={deleteMutation.isPending}
                  onClick={() => void onDelete(genre)}
                >
                  {copy.admin.delete}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </AdminFrame>
  )
}
