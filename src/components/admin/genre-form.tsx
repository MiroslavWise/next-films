"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { adminKeys, useGenreQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { buttonClass, fieldClass, panelClass } from "@/lib/ui"
import type { NamedRef } from "@/types/api"

export function GenreForm({ mode, genreId }: { mode: "create" | "edit"; genreId?: string }) {
  const queryClient = useQueryClient()
  const genreQuery = useGenreQuery(genreId, mode === "edit")
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  useEffect(() => {
    const genre = genreQuery.data
    if (!genre || hydratedId === genre.id) return
    setName(genre.name)
    setHydratedId(genre.id)
  }, [genreQuery.data, hydratedId])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({ name })
      if (mode === "edit" && genreId) {
        return api<{ genre: NamedRef }>(`/api/admin/genres/${genreId}`, { method: "PATCH", body })
      }
      return api<{ genre: NamedRef }>("/api/admin/genres", { method: "POST", body })
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.genres() })
      if (mode === "edit" && genreId) {
        queryClient.setQueryData(adminKeys.genre(genreId), data.genre)
      }
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setMessage("")
    try {
      await saveMutation.mutateAsync()
      if (mode === "create") setName("")
      setMessage(copy.admin.saved)
    } catch (caught) {
      setMessage("")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const loading = mode === "edit" && genreQuery.isPending
  const loadError = genreQuery.isError
    ? genreQuery.error instanceof ApiRequestError
      ? genreQuery.error.message
      : copy.internal
    : ""

  return (
    <AdminFrame
      title={mode === "create" ? copy.admin.genreAdd : copy.admin.genreEdit}
      backHref="/admin/genres"
      backLabel={copy.admin.genres}
    >
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}
      {loading ? <MovieFormSkeleton /> : null}

      {!loading && (mode === "create" || genreQuery.data) ? (
        <form onSubmit={onSubmit} className={`${panelClass} grid gap-3`}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">{copy.admin.name}</span>
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <button className={buttonClass} type="submit" disabled={saveMutation.isPending}>
            {mode === "edit" ? copy.admin.save : copy.admin.add}
          </button>
        </form>
      ) : null}
    </AdminFrame>
  )
}
