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
import { ADMIN_MOVIES_PAGE_SIZE, copy } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { uuidv7 } from "@/lib/uuid"
import type { MovieRecord, NamedRef, PersonRecord } from "@/types/api"

type Refs = {
  genres: NamedRef[]
  actors: PersonRecord[]
  directors: PersonRecord[]
  producers: PersonRecord[]
}

type MoviesPage = {
  movies: MovieRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

const emptyRefs: Refs = { genres: [], actors: [], directors: [], producers: [] }

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function MovieManager() {
  const { ready } = useTelegram()
  const [refs, setRefs] = useState<Refs>(emptyRefs)
  const [moviesPage, setMoviesPage] = useState<MoviesPage>({
    movies: [],
    total: 0,
    page: 1,
    pageSize: ADMIN_MOVIES_PAGE_SIZE,
    pageCount: 1,
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
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

  const loadMovies = useCallback(async (nextPage: number) => {
    const data = await api<MoviesPage>(`/api/admin/movies?page=${nextPage}&pageSize=${ADMIN_MOVIES_PAGE_SIZE}`)
    setMoviesPage(data)
    setPage(data.page)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timeout = window.setTimeout(() => {
      void Promise.all([loadRefs(), loadMovies(1)]).catch((caught: unknown) => {
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
      })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [ready, loadRefs, loadMovies])

  function resetFormFields() {
    setEditing(null)
    setTitle("")
    setFile(null)
    setFileKey((value) => value + 1)
    setGenreIds([])
    setActorIds([])
    setDirectorIds([])
    setProducerIds([])
  }

  function closeForm() {
    resetFormFields()
    setFormOpen(false)
  }

  function openCreate() {
    resetFormFields()
    setMessage("")
    setError("")
    setFormOpen(true)
  }

  function openEdit(movie: MovieRecord) {
    setEditing(movie)
    setTitle(movie.title)
    setFile(null)
    setFileKey((value) => value + 1)
    setGenreIds(movie.genres.map((item) => item.id))
    setActorIds(movie.actors.map((item) => item.id))
    setDirectorIds(movie.directors.map((item) => item.id))
    setProducerIds(movie.producers.map((item) => item.id))
    setMessage("")
    setError("")
    setFormOpen(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!editing && !file) {
      setError(copy.admin.posterRequired)
      setMessage("")
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
      resetFormFields()
      setFormOpen(false)
      setMessage(copy.admin.saved)
      await loadMovies(editing ? page : 1)
    } catch (caught) {
      setMessage("")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setPending(false)
    }
  }

  async function onDelete(movie: MovieRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${movie.title}?`)) return
    setError("")
    setMessage("")
    try {
      await api(`/api/admin/movies/${movie.id}`, { method: "DELETE" })
      if (editing?.id === movie.id) closeForm()
      setMessage(copy.admin.deleted)
      const nextPage = moviesPage.movies.length <= 1 && page > 1 ? page - 1 : page
      await loadMovies(nextPage)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  return (
    <AdminFrame title={copy.admin.movies}>
      {!formOpen ? (
        <button className={buttonClass} type="button" onClick={openCreate}>
          {copy.admin.add}
        </button>
      ) : null}

      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {formOpen ? (
        <form onSubmit={onSubmit} className={`${panelClass} grid gap-4`}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">{copy.admin.titleField}</span>
            <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <FileUploadField
            label={copy.admin.poster}
            hint={editing ? copy.admin.optional : copy.admin.required}
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
              {editing ? copy.admin.save : copy.admin.add}
            </button>
            <button className={ghostButtonClass} type="button" onClick={closeForm}>
              {editing ? copy.admin.cancel : copy.admin.closeForm}
            </button>
          </div>
        </form>
      ) : null}

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
                <button type="button" className={linkActionClass} onClick={() => openEdit(movie)}>
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
