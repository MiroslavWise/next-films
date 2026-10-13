"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { FileUploadField } from "@/components/admin/file-upload-field"
import { ApiRequestError, api, uploadPhoto } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { buttonClass, fieldClass, panelClass } from "@/lib/ui"
import { uuidv7 } from "@/lib/uuid"
import type { MovieRecord, NamedRef, PersonRecord } from "@/types/api"

type Refs = {
  genres: NamedRef[]
  actors: PersonRecord[]
  directors: PersonRecord[]
  producers: PersonRecord[]
}

const emptyRefs: Refs = { genres: [], actors: [], directors: [], producers: [] }

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function MovieForm({ mode, movieId }: { mode: "create" | "edit"; movieId?: string }) {
  const { ready } = useTelegram()
  const [refs, setRefs] = useState<Refs>(emptyRefs)
  const [loaded, setLoaded] = useState(mode === "create")
  const [editing, setEditing] = useState<MovieRecord | null>(null)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [genreIds, setGenreIds] = useState<string[]>([])
  const [actorIds, setActorIds] = useState<string[]>([])
  const [directorIds, setDirectorIds] = useState<string[]>([])
  const [producerIds, setProducerIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const loadRefs = useCallback(async () => {
    const [genres, actors, directors, producers] = await Promise.all([
      api<{ genres: NamedRef[] }>("/api/admin/genres"),
      api<{ people: PersonRecord[] }>("/api/admin/people/actors"),
      api<{ people: PersonRecord[] }>("/api/admin/people/directors"),
      api<{ people: PersonRecord[] }>("/api/admin/people/producers"),
    ])
    setRefs({
      genres: genres.genres,
      actors: actors.people,
      directors: directors.people,
      producers: producers.people,
    })
  }, [])

  const loadMovie = useCallback(async (id: string) => {
    const data = await api<{ movie: MovieRecord }>(`/api/admin/movies/${id}`)
    const movie = data.movie
    setEditing(movie)
    setTitle(movie.title)
    setGenreIds(movie.genres.map((item) => item.id))
    setActorIds(movie.actors.map((item) => item.id))
    setDirectorIds(movie.directors.map((item) => item.id))
    setProducerIds(movie.producers.map((item) => item.id))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          await loadRefs()
          if (mode === "edit" && movieId) await loadMovie(movieId)
        } catch (caught) {
          setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
          setLoaded(true)
        }
      })()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [ready, mode, movieId, loadRefs, loadMovie])

  function clearCreateFields() {
    setTitle("")
    setFile(null)
    setFileKey((value) => value + 1)
    setGenreIds([])
    setActorIds([])
    setDirectorIds([])
    setProducerIds([])
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (mode === "create" && !file) {
      setError(copy.admin.posterRequired)
      setMessage("")
      return
    }
    setPending(true)
    setError("")
    setMessage("")
    try {
      const id = editing?.id ?? uuidv7()
      let posterUrl = editing?.posterUrl ?? ""
      let posterBlurhash = editing?.posterBlurhash ?? ""
      if (file) {
        const uploaded = await uploadPhoto(file, "poster", id)
        posterUrl = uploaded.url
        posterBlurhash = uploaded.blurhash
      }
      const body = JSON.stringify({
        id,
        title,
        posterUrl,
        posterBlurhash,
        genreIds,
        actorIds,
        directorIds,
        producerIds,
      })
      if (mode === "edit" && editing) {
        const updated = await api<{ movie: MovieRecord }>(`/api/admin/movies/${editing.id}`, { method: "PATCH", body })
        setEditing(updated.movie)
        setFile(null)
        setFileKey((value) => value + 1)
      } else {
        await api("/api/admin/movies", { method: "POST", body })
        clearCreateFields()
      }
      setMessage(copy.admin.saved)
    } catch (caught) {
      setMessage("")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setPending(false)
    }
  }

  return (
    <AdminFrame
      title={mode === "create" ? copy.admin.movieAdd : copy.admin.movieEdit}
      backHref="/admin/movies"
      backLabel={copy.admin.movies}
    >
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {!loaded ? <p className="text-sm text-(--tg-theme-hint-color)">{copy.loading}</p> : null}

      {loaded && (mode === "create" || editing) ? (
        <form onSubmit={onSubmit} className={`${panelClass} grid gap-4`}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">{copy.admin.titleField}</span>
            <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <FileUploadField
            label={copy.admin.poster}
            hint={mode === "edit" ? copy.admin.optional : copy.admin.required}
            fileName={file?.name ?? null}
            resetKey={fileKey}
            onChange={setFile}
          />
          <CheckList
            title={copy.admin.genres}
            items={refs.genres}
            selected={genreIds}
            onToggle={(id) => setGenreIds((current) => toggle(current, id))}
          />
          <CheckList
            title={copy.admin.actors}
            items={refs.actors}
            selected={actorIds}
            onToggle={(id) => setActorIds((current) => toggle(current, id))}
          />
          <CheckList
            title={copy.admin.directors}
            items={refs.directors}
            selected={directorIds}
            onToggle={(id) => setDirectorIds((current) => toggle(current, id))}
          />
          <CheckList
            title={copy.admin.producers}
            items={refs.producers}
            selected={producerIds}
            onToggle={(id) => setProducerIds((current) => toggle(current, id))}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={buttonClass} type="submit" disabled={pending}>
              {mode === "edit" ? copy.admin.save : copy.admin.add}
            </button>
          </div>
        </form>
      ) : null}
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
