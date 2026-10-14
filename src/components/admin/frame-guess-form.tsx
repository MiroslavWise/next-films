"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { FileUploadField } from "@/components/admin/file-upload-field"
import { BlurImage } from "@/components/blur-image"
import { adminKeys, uploadFrameGuessFrame, useFrameGuessEntryQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { panelClass } from "@/lib/ui"
import { useTelegram } from "@/lib/telegram/use-telegram"
import type { FrameGuessEntryRecord } from "@/types/api"

const frameCardClass =
  "group relative aspect-video overflow-hidden rounded-[6px] border border-(--surface-border) bg-(--tg-theme-bg-color)"

export function FrameGuessForm({ movieId }: { movieId: string }) {
  const queryClient = useQueryClient()
  const { confirm } = useTelegram()
  const entryQuery = useFrameGuessEntryQuery(movieId)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [fileKey, setFileKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  useEffect(() => {
    if (!revealedId) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(`[data-frame-card="${revealedId}"]`)) return
      setRevealedId(null)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [revealedId])

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
    try {
      const results = await Promise.all(files.map((file) => uploadFrameGuessFrame(movieId, file)))
      const latest = results.reduce((best, item) =>
        item.entry.frames.length >= best.entry.frames.length ? item : best,
      )
      queryClient.setQueryData(adminKeys.frameGuess(movieId), latest.entry)
      setMessage(results.length === 1 ? copy.admin.frameAdded : copy.admin.framesAdded)
    } catch (caught) {
      await queryClient.invalidateQueries({ queryKey: adminKeys.frameGuess(movieId) })
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setUploading(false)
      setFileKey((value) => value + 1)
    }
  }

  async function onDelete(frameId: string) {
    const ok = await confirm({
      title: copy.admin.frameDeleteTitle,
      message: copy.admin.frameDeleteMessage,
      confirmText: copy.admin.delete,
    })
    if (!ok) {
      setRevealedId(null)
      return
    }
    setError("")
    setMessage("")
    setRevealedId(null)
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
            <ul className="grid grid-cols-2 gap-2">
              {entry.frames.map((frame) => {
                const revealed = revealedId === frame.id
                return (
                  <li key={frame.id}>
                    <div
                      data-frame-card={frame.id}
                      className={frameCardClass}
                      onClick={() => {
                        if (busy) return
                        setRevealedId((current) => (current === frame.id ? null : frame.id))
                      }}
                    >
                      <div
                        className={`absolute inset-0 transition-[filter,transform] duration-200 ease-out ${
                          revealed
                            ? "scale-[1.03] blur-[3px]"
                            : "group-hover:scale-[1.03] group-hover:blur-[3px] group-focus-within:scale-[1.03] group-focus-within:blur-[3px]"
                        }`}
                      >
                        <BlurImage
                          src={frame.url}
                          alt={`${copy.admin.frames}: ${entry.movieTitle}`}
                          blurhash={frame.blurhash}
                          sizes="50vw"
                          orientation="landscape"
                          objectFit="cover"
                        />
                      </div>
                      <div
                        className={`absolute inset-0 flex items-end justify-center bg-[color-mix(in_srgb,black_40%,transparent)] p-2 transition-opacity duration-200 ${
                          revealed
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          className="h-8 rounded-md bg-(--danger) px-3 text-xs font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
                          onClick={(event) => {
                            event.stopPropagation()
                            void onDelete(frame.id)
                          }}
                        >
                          {copy.admin.delete}
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
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
