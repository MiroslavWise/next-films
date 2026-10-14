"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { FileUploadField } from "@/components/admin/file-upload-field"
import { BlurImage } from "@/components/blur-image"
import { adminKeys, uploadFrameGuessFrame, useFrameGuessEntryQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { dangerActionClass, panelClass } from "@/lib/ui"
import type { FrameGuessEntryRecord } from "@/types/api"

export function FrameGuessForm({ movieId }: { movieId: string }) {
  const queryClient = useQueryClient()
  const entryQuery = useFrameGuessEntryQuery(movieId)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [fileKey, setFileKey] = useState(0)
  const [uploading, setUploading] = useState(false)

  const activeMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api<{ entry: FrameGuessEntryRecord }>(`/api/admin/movies/${movieId}/frame-guess`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.frameGuess(movieId), data.entry)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (frameId: string) =>
      api<{ entry: FrameGuessEntryRecord }>(`/api/admin/movies/${movieId}/frame-guess/frames/${frameId}`, {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.frameGuess(movieId), data.entry)
    },
  })

  async function onFilesSelected(files: File[]) {
    if (files.length === 0) return
    setError("")
    setMessage("")
    setUploading(true)
    let added = 0
    try {
      for (const file of files) {
        const data = await uploadFrameGuessFrame(movieId, file)
        queryClient.setQueryData(adminKeys.frameGuess(movieId), data.entry)
        added += 1
      }
      setMessage(added === 1 ? copy.admin.frameAdded : copy.admin.framesAdded)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setUploading(false)
      setFileKey((value) => value + 1)
    }
  }

  async function onDelete(frameId: string) {
    if (!window.confirm(copy.admin.delete)) return
    setError("")
    setMessage("")
    try {
      await deleteMutation.mutateAsync(frameId)
      setMessage(copy.admin.frameDeleted)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  async function onToggleActive(next: boolean) {
    setError("")
    setMessage("")
    try {
      await activeMutation.mutateAsync(next)
      setMessage(copy.admin.saved)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const entry = entryQuery.data
  const busy = uploading || deleteMutation.isPending || activeMutation.isPending
  const loadError = entryQuery.isError ? (entryQuery.error instanceof ApiRequestError ? entryQuery.error.message : copy.internal) : ""

  return (
    <AdminFrame
      title={entry?.movieTitle ? `${copy.admin.frames}: ${entry.movieTitle}` : copy.admin.framesTitle}
      backHref="/admin/movies"
      backLabel={copy.admin.movies}
    >
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}

      {entryQuery.isPending ? <MovieFormSkeleton /> : null}

      {entry ? (
        <div className="grid gap-4">
          <p className="text-sm text-(--tg-theme-hint-color)">{copy.admin.framesHint}</p>

          <label className={`${panelClass} flex items-center justify-between gap-3`}>
            <span className="text-sm font-medium">{copy.admin.framesActive}</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-(--tg-theme-button-color)"
              checked={entry.isActive}
              disabled={busy}
              onChange={(event) => void onToggleActive(event.target.checked)}
            />
          </label>

          <div className={panelClass}>
            <FileUploadField
              label={copy.admin.framesAdd}
              hint={uploading ? copy.admin.framesUploading : copy.admin.optional}
              resetKey={fileKey}
              multiple
              disabled={busy}
              onChange={() => undefined}
              onFilesChange={(files) => void onFilesSelected(files)}
            />
          </div>

          {entry.frames.length === 0 ? (
            <p className={`${panelClass} text-sm text-(--tg-theme-hint-color)`}>{copy.admin.framesEmpty}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {entry.frames.map((frame) => (
                <li key={frame.id} className={`${panelClass} grid gap-2 p-2`}>
                  <div className="relative aspect-video overflow-hidden rounded-sm bg-(--tg-theme-bg-color)">
                    <BlurImage
                      src={frame.url}
                      alt={`${copy.admin.frames}: ${entry.movieTitle}`}
                      blurhash={frame.blurhash}
                      sizes="50vw"
                      orientation="landscape"
                      objectFit="contain"
                    />
                  </div>
                  <button
                    type="button"
                    className={`${dangerActionClass} justify-self-start`}
                    disabled={busy}
                    onClick={() => void onDelete(frame.id)}
                  >
                    {copy.admin.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {uploading ? (
            <p className="text-sm text-(--tg-theme-hint-color)" role="status">
              {copy.admin.framesUploading}
            </p>
          ) : null}
        </div>
      ) : null}
    </AdminFrame>
  )
}
