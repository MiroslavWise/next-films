"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { RowsListSkeleton } from "@/components/admin/admin-skeletons"
import { adminKeys, useGenresQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import {
  buttonClass,
  dangerActionClass,
  fieldClass,
  ghostButtonClass,
  linkActionClass,
  panelClass,
} from "@/lib/ui"
import type { NamedRef } from "@/types/api"

export function GenreManager() {
  const queryClient = useQueryClient()
  const genresQuery = useGenresQuery()
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<NamedRef | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({ name })
      if (editing) {
        return api(`/api/admin/genres/${editing.id}`, { method: "PATCH", body })
      }
      return api("/api/admin/genres", { method: "POST", body })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.genres() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (genre: NamedRef) => api(`/api/admin/genres/${genre.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.genres() })
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setMessage("")
    try {
      await saveMutation.mutateAsync()
      setName("")
      setEditing(null)
      setMessage(copy.admin.saved)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  async function onDelete(genre: NamedRef) {
    if (!window.confirm(`${copy.admin.delete}: ${genre.name}?`)) return
    setError("")
    setMessage("")
    try {
      await deleteMutation.mutateAsync(genre)
      if (editing?.id === genre.id) {
        setEditing(null)
        setName("")
      }
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
      <form onSubmit={onSubmit} className={`${panelClass} grid gap-3`}>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{copy.admin.name}</span>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} type="submit" disabled={saveMutation.isPending}>
            {editing ? copy.admin.save : copy.admin.add}
          </button>
          {editing ? (
            <button
              className={ghostButtonClass}
              type="button"
              onClick={() => {
                setEditing(null)
                setName("")
              }}
            >
              {copy.admin.cancel}
            </button>
          ) : null}
        </div>
      </form>
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
                <button
                  type="button"
                  className={linkActionClass}
                  onClick={() => {
                    setEditing(genre)
                    setName(genre.name)
                  }}
                >
                  {copy.admin.edit}
                </button>
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
