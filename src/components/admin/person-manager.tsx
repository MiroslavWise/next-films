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
import { ApiRequestError, api, uploadPhoto } from "@/lib/api-client"
import { copy } from "@/lib/constants"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { uuidv7 } from "@/lib/uuid"
import type { PersonKind } from "@/lib/validators"
import type { PersonRecord } from "@/types/api"

export function PersonManager({ kind, title }: { kind: PersonKind; title: string }) {
  const { ready } = useTelegram()
  const [people, setPeople] = useState<PersonRecord[]>([])
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [editing, setEditing] = useState<PersonRecord | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    const data = await api<{ people: PersonRecord[] }>(`/api/admin/people/${kind}`)
    setPeople(data.people)
  }, [kind])

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
        await api(`/api/admin/people/${kind}/${editing.id}`, { method: "PATCH", body })
      } else {
        await api(`/api/admin/people/${kind}`, { method: "POST", body })
      }
      setName("")
      setFile(null)
      setEditing(null)
      setMessage(copy.admin.saved)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    } finally {
      setPending(false)
    }
  }

  async function onDelete(person: PersonRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${person.name}?`)) return
    setError("")
    try {
      await api(`/api/admin/people/${kind}/${person.id}`, { method: "DELETE" })
      setMessage(copy.admin.deleted)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

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
          onChange={setFile}
        />
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
                setFile(null)
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
        {people.length === 0 ? (
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
                }}
              >
                {copy.admin.edit}
              </button>
              <button type="button" className={dangerActionClass} onClick={() => void onDelete(person)}>
                {copy.admin.delete}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </AdminFrame>
  )
}
