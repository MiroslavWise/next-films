"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { MovieFormSkeleton } from "@/components/admin/admin-skeletons"
import { FileUploadField } from "@/components/admin/file-upload-field"
import { adminKeys, usePersonQuery } from "@/lib/admin-queries"
import { ApiRequestError, api, uploadPhoto } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { buttonClass, fieldClass, panelClass } from "@/lib/ui"
import { uuidv7 } from "@/lib/uuid"
import type { PersonKind } from "@/lib/validators"
import type { PersonRecord } from "@/types/api"

export function PersonForm({
  kind,
  mode,
  personId,
  title,
  backHref,
  backLabel,
}: {
  kind: PersonKind
  mode: "create" | "edit"
  personId?: string
  title: string
  backHref: string
  backLabel: string
}) {
  const queryClient = useQueryClient()
  const personQuery = usePersonQuery(kind, personId, mode === "edit")
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [hydratedId, setHydratedId] = useState<string | null>(null)

  useEffect(() => {
    const person = personQuery.data
    if (!person || hydratedId === person.id) return
    setName(person.name)
    setHydratedId(person.id)
  }, [personQuery.data, hydratedId])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextId = personQuery.data?.id ?? uuidv7()
      let photoUrl = personQuery.data?.photoUrl ?? null
      let photoBlurhash = personQuery.data?.photoBlurhash ?? null
      if (file) {
        const uploaded = await uploadPhoto(file, "portrait", nextId)
        photoUrl = uploaded.url
        photoBlurhash = uploaded.blurhash
      }
      const body = JSON.stringify({ id: nextId, name, photoUrl, photoBlurhash })
      if (mode === "edit" && personQuery.data) {
        return api<{ person: PersonRecord }>(`/api/admin/people/${kind}/${personQuery.data.id}`, {
          method: "PATCH",
          body,
        })
      }
      return api<{ person: PersonRecord }>(`/api/admin/people/${kind}`, { method: "POST", body })
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.people(kind) })
      if (mode === "edit" && personId) {
        queryClient.setQueryData(adminKeys.person(kind, personId), data.person)
      }
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setMessage("")
    try {
      await saveMutation.mutateAsync()
      if (mode === "create") {
        setName("")
        setFile(null)
        setFileKey((value) => value + 1)
      } else {
        setFile(null)
        setFileKey((value) => value + 1)
      }
      setMessage(copy.admin.saved)
    } catch (caught) {
      setMessage("")
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const loading = mode === "edit" && personQuery.isPending
  const loadError = personQuery.isError
    ? personQuery.error instanceof ApiRequestError
      ? personQuery.error.message
      : copy.internal
    : ""

  return (
    <AdminFrame title={title} backHref={backHref} backLabel={backLabel}>
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}
      {loading ? <MovieFormSkeleton /> : null}

      {!loading && (mode === "create" || personQuery.data) ? (
        <form onSubmit={onSubmit} className={`${panelClass} grid gap-3`}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">{copy.admin.name}</span>
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <FileUploadField
            label={copy.admin.photo}
            hint={copy.admin.optional}
            fileName={file?.name ?? null}
            resetKey={fileKey}
            onChange={setFile}
          />
          <button className={buttonClass} type="submit" disabled={saveMutation.isPending}>
            {mode === "edit" ? copy.admin.save : copy.admin.add}
          </button>
        </form>
      ) : null}
    </AdminFrame>
  )
}
