"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import {
  buttonClass,
  dangerActionClass,
  fieldClass,
  ghostButtonClass,
  linkActionClass,
  panelClass,
} from "@/lib/ui"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import type { NamedRef } from "@/types/api"

export function GenreManager() {
  const { ready } = useTelegram()
  const [genres, setGenres] = useState<NamedRef[]>([])
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<NamedRef | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    const data = await api<{ genres: NamedRef[] }>("/api/admin/genres")
    setGenres(data.genres)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timeout = window.setTimeout(() => {
      void load().catch((caught: unknown) => {
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [ready, load])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    setMessage("")
    try {
      const body = JSON.stringify({ name })
      if (editing) {
        await api(`/api/admin/genres/${editing.id}`, { method: "PATCH", body })
      } else {
        await api("/api/admin/genres", { method: "POST", body })
      }
      setName("")
      setEditing(null)
      setMessage(copy.admin.saved)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setPending(false)
    }
  }

  async function onDelete(genre: NamedRef) {
    if (!window.confirm(`${copy.admin.delete}: ${genre.name}?`)) return
    setError("")
    try {
      await api(`/api/admin/genres/${genre.id}`, { method: "DELETE" })
      setMessage(copy.admin.deleted)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  return (
    <AdminFrame title={copy.admin.genres}>
      <form onSubmit={onSubmit} className={`${panelClass} grid gap-3`}>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{copy.admin.name}</span>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} type="submit" disabled={pending}>
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
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
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
              <button type="button" className={dangerActionClass} onClick={() => void onDelete(genre)}>
                {copy.admin.delete}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </AdminFrame>
  )
}
