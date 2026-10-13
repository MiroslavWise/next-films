"use client"

import { useEffect, useState, type FormEvent } from "react"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { FileUploadField } from "@/components/admin/file-upload-field"
import { useCatalogRefsQuery, useMovieQuery, useSaveMovieMutation } from "@/lib/admin-queries"
import { ApiRequestError } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { buttonClass, fieldClass, panelClass } from "@/lib/ui"
import { uuidv7 } from "@/lib/uuid"

function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
}

export function MovieForm({ mode, movieId }: { mode: "create" | "edit"; movieId?: string }) {
  const refs = useCatalogRefsQuery()
  const movieQuery = useMovieQuery(movieId, mode === "edit")
  const saveMutation = useSaveMovieMutation()

  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [genreIds, setGenreIds] = useState<string[]>([])
  const [actorIds, setActorIds] = useState<string[]>([])
  const [directorIds, setDirectorIds] = useState<string[]>([])
  const [producerIds, setProducerIds] = useState<string[]>([])
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  useEffect(() => {
    const movie = movieQuery.data
    if (!movie || hydratedId === movie.id) return
    setTitle(movie.title)
    setGenreIds(movie.genres.map((item) => item.id))
    setActorIds(movie.actors.map((item) => item.id))
    setDirectorIds(movie.directors.map((item) => item.id))
    setProducerIds(movie.producers.map((item) => item.id))
    setHydratedId(movie.id)
  }, [movieQuery.data, hydratedId])

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
    setError("")
    setMessage("")
    try {
      const nextId = movieQuery.data?.id ?? uuidv7()
      await saveMutation.mutateAsync({
        mode,
        movieId: movieQuery.data?.id,
        title,
        file,
        existing: movieQuery.data,
        genreIds,
        actorIds,
        directorIds,
        producerIds,
        nextId,
      })
      if (mode === "create") clearCreateFields()
      else {
        setFile(null)
        setFileKey((value) => value + 1)
      }
      setMessage(copy.admin.saved)
    } catch (caught) {
      setMessage("")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const loading = refs.isPending || (mode === "edit" && movieQuery.isPending)
  const loadError =
    refs.isError || movieQuery.isError
      ? ((refs.error ?? movieQuery.error) instanceof ApiRequestError
          ? (refs.error ?? movieQuery.error)!.message
          : copy.internal)
      : ""

  return (
    <AdminFrame
      title={mode === "create" ? copy.admin.movieAdd : copy.admin.movieEdit}
      backHref="/admin/movies"
      backLabel={copy.admin.movies}
    >
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}

      {loading ? <p className="text-sm text-(--tg-theme-hint-color)">{copy.loading}</p> : null}

      {!loading && (mode === "create" || movieQuery.data) ? (
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
            <button className={buttonClass} type="submit" disabled={saveMutation.isPending}>
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
