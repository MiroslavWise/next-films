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
import { FileUploadField } from "@/components/admin/file-upload-field"
import { BlurImage } from "@/components/blur-image"
import { ApiRequestError, api, uploadPhoto } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { uuidv7 } from "@/lib/uuid"
import type { MovieRecord, NamedRef, PersonRecord } from "@/types/api"

type Catalog = {
  movies: MovieRecord[]
  genres: NamedRef[]
  actors: PersonRecord[]
  directors: PersonRecord[]
  producers: PersonRecord[]
}

const emptyCatalog: Catalog = { movies: [], genres: [], actors: [], directors: [], producers: [] }

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function MovieManager() {
  const { ready } = useTelegram()
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog)
  const [editing, setEditing] = useState<MovieRecord | null>(null)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [genreIds, setGenreIds] = useState<string[]>([])
  const [actorIds, setActorIds] = useState<string[]>([])
  const [directorIds, setDirectorIds] = useState<string[]>([])
  const [producerIds, setProducerIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    const [movies, genres, actors, directors, producers] = await Promise.all([
      api<{ movies: MovieRecord[] }>("/api/admin/movies"),
      api<{ genres: NamedRef[] }>("/api/admin/genres"),
      api<{ people: PersonRecord[] }>("/api/admin/people/actors"),
      api<{ people: PersonRecord[] }>("/api/admin/people/directors"),
      api<{ people: PersonRecord[] }>("/api/admin/people/producers"),
    ])
    setCatalog({
      movies: movies.movies,
      genres: genres.genres,
      actors: actors.people,
      directors: directors.people,
      producers: producers.people,
    })
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

  function resetForm() {
    setEditing(null)
    setTitle("")
    setFile(null)
    setGenreIds([])
    setActorIds([])
    setDirectorIds([])
    setProducerIds([])
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing && !file) {
      setError(copy.admin.posterRequired)
      return
    }
    setPending(true)
    setError("")
    setMessage("")
    try {
      const movieId = editing?.id ?? uuidv7()
      let posterUrl = editing?.posterUrl ?? ""
      let posterBlurhash = editing?.posterBlurhash ?? ""
      if (file) {
        const uploaded = await uploadPhoto(file, "poster", movieId)
        posterUrl = uploaded.url
        posterBlurhash = uploaded.blurhash
      }
      const body = JSON.stringify({
        id: movieId,
        title,
        posterUrl,
        posterBlurhash,
        genreIds,
        actorIds,
        directorIds,
        producerIds,
      })
      if (editing) {
        await api(`/api/admin/movies/${editing.id}`, { method: "PATCH", body })
      } else {
        await api("/api/admin/movies", { method: "POST", body })
      }
      resetForm()
      setMessage(copy.admin.saved)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setPending(false)
    }
  }

  async function onDelete(movie: MovieRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${movie.title}?`)) return
    setError("")
    try {
      await api(`/api/admin/movies/${movie.id}`, { method: "DELETE" })
      if (editing?.id === movie.id) resetForm()
      setMessage(copy.admin.deleted)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  return (
    <AdminFrame title={copy.admin.movies}>
      <form onSubmit={onSubmit} className={`${panelClass} grid gap-4`}>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{copy.admin.titleField}</span>
          <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <FileUploadField
          label={copy.admin.poster}
          hint={editing ? copy.admin.optional : copy.admin.required}
          fileName={file?.name ?? null}
          onChange={setFile}
        />
        <CheckList
          title={copy.admin.genres}
          items={catalog.genres}
          selected={genreIds}
          onToggle={(id) => setGenreIds((current) => toggle(current, id))}
        />
        <CheckList
          title={copy.admin.actors}
          items={catalog.actors}
          selected={actorIds}
          onToggle={(id) => setActorIds((current) => toggle(current, id))}
        />
        <CheckList
          title={copy.admin.directors}
          items={catalog.directors}
          selected={directorIds}
          onToggle={(id) => setDirectorIds((current) => toggle(current, id))}
        />
        <CheckList
          title={copy.admin.producers}
          items={catalog.producers}
          selected={producerIds}
          onToggle={(id) => setProducerIds((current) => toggle(current, id))}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <button className={buttonClass} type="submit" disabled={pending}>
            {editing ? copy.admin.save : copy.admin.add}
          </button>
          {editing ? (
            <button className={ghostButtonClass} type="button" onClick={resetForm}>
              {copy.admin.cancel}
            </button>
          ) : null}
        </div>
      </form>
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <ul className="grid gap-3">
        {catalog.movies.map((movie) => (
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
                <button
                  type="button"
                  className={linkActionClass}
                  onClick={() => {
                    setEditing(movie)
                    setTitle(movie.title)
                    setFile(null)
                    setGenreIds(movie.genres.map((item) => item.id))
                    setActorIds(movie.actors.map((item) => item.id))
                    setDirectorIds(movie.directors.map((item) => item.id))
                    setProducerIds(movie.producers.map((item) => item.id))
                  }}
                >
                  {copy.admin.edit}
                </button>
                <button type="button" className={dangerActionClass} onClick={() => void onDelete(movie)}>
                  {copy.admin.delete}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AdminFrame>
  )
}

function CheckList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: { id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">
        {title} <span className="font-normal text-(--tg-theme-hint-color)">{copy.admin.optional}</span>
      </legend>
      {items.length === 0 ? <p className="text-sm text-(--tg-theme-hint-color)">{copy.admin.emptyList}</p> : null}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = selected.includes(item.id)
          return (
            <label
              key={item.id}
              className={`inline-flex cursor-pointer items-center rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-(--tg-theme-button-color) bg-[color-mix(in_srgb,var(--tg-theme-button-color)_14%,transparent)] font-medium"
                  : "border-(--surface-border) bg-(--tg-theme-bg-color) text-(--tg-theme-hint-color)"
              }`}
            >
              <input className="sr-only" type="checkbox" checked={active} onChange={() => onToggle(item.id)} />
              {item.name}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
