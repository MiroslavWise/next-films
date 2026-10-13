"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { FileUploadField } from "@/components/admin/file-upload-field"
import { adminKeys, usePeopleQuery } from "@/lib/admin-queries"
import { ApiRequestError, api, uploadPhoto } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { uuidv7 } from "@/lib/uuid"
import {
  buttonClass,
  dangerActionClass,
  fieldClass,
  ghostButtonClass,
  linkActionClass,
  panelClass,
} from "@/lib/ui"
import type { PersonKind } from "@/lib/validators"
import type { PersonRecord } from "@/types/api"

export function PersonManager({ kind, title }: { kind: PersonKind; title: string }) {
  const queryClient = useQueryClient()
  const peopleQuery = usePeopleQuery(kind)
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [editing, setEditing] = useState<PersonRecord | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const saveMutation = useMutation({
    mutationFn: async () => {
      const personId = editing?.id ?? uuidv7()
      let photoUrl = editing?.photoUrl ?? null
      let photoBlurhash = editing?.photoBlurhash ?? null
      if (file) {
        const uploaded = await uploadPhoto(file, "portrait", personId)
        photoUrl = uploaded.url
        photoBlurhash = uploaded.blurhash
      }
      const body = JSON.stringify({ id: personId, name, photoUrl, photoBlurhash })
      if (editing) {
        return api(`/api/admin/people/${kind}/${editing.id}`, { method: "PATCH", body })
      }
      return api(`/api/admin/people/${kind}`, { method: "POST", body })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.people(kind) })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (person: PersonRecord) => api(`/api/admin/people/${kind}/${person.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.people(kind) })
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setMessage("")
    try {
      await saveMutation.mutateAsync()
      setName("")
      setFile(null)
      setFileKey((value) => value + 1)
      setEditing(null)
      setMessage(copy.admin.saved)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  async function onDelete(person: PersonRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${person.name}?`)) return
    setError("")
    setMessage("")
    try {
      await deleteMutation.mutateAsync(person)
      if (editing?.id === person.id) {
        setEditing(null)
        setName("")
        setFile(null)
        setFileKey((value) => value + 1)
      }
      setMessage(copy.admin.deleted)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const people = peopleQuery.data ?? []
  const loadError = peopleQuery.isError
    ? peopleQuery.error instanceof ApiRequestError
      ? peopleQuery.error.message
      : copy.internal
    : ""

  return (
    <AdminFrame title={title}>
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
                setFile(null)
                setFileKey((value) => value + 1)
              }}
            >
              {copy.admin.cancel}
            </button>
          ) : null}
        </div>
      </form>
      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}
      {peopleQuery.isPending ? <p className="text-sm text-(--tg-theme-hint-color)">{copy.loading}</p> : null}
      <ul className={`${panelClass} divide-y divide-(--surface-border) p-0`}>
        {!peopleQuery.isPending && people.length === 0 ? (
          <li className="px-4 py-3 text-sm text-(--tg-theme-hint-color)">{copy.admin.emptyList}</li>
        ) : null}
        {people.map((person) => (
          <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="font-medium">{person.name}</span>
            <span className="flex gap-4">
              <button
                type="button"
                className={linkActionClass}
                onClick={() => {
                  setEditing(person)
                  setName(person.name)
                  setFile(null)
                  setFileKey((value) => value + 1)
                }}
              >
                {copy.admin.edit}
              </button>
              <button
                type="button"
                className={dangerActionClass}
                disabled={deleteMutation.isPending}
                onClick={() => void onDelete(person)}
              >
                {copy.admin.delete}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </AdminFrame>
  )
}
