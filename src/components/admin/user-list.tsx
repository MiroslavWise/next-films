"use client"

import { useEffect, useState } from "react"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { RowsListSkeleton } from "@/components/admin/admin-skeletons"
import { copy } from "@/lib/constants"
import { isServerlessAvailable, serverlessCall } from "@/lib/telegram/serverless-call"
import { useTelegram } from "@/lib/telegram/use-telegram"
import { panelClass } from "@/lib/ui"
import type { ListUsersResponse, VisitorProfile } from "@/types/api"

function formatVisit(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function UserList() {
  const { ready, isTelegram } = useTelegram()
  const [users, setUsers] = useState<VisitorProfile[] | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      if (!isTelegram || !isServerlessAvailable()) {
        if (!cancelled) {
          setUsers([])
          setError(copy.admin.usersUnavailable)
          setLoading(false)
        }
        return
      }
      try {
        const data = await serverlessCall<ListUsersResponse>("listUsers")
        if (!cancelled) setUsers(data.users ?? [])
      } catch (caught) {
        if (!cancelled) {
          setUsers([])
          setError(caught instanceof Error ? caught.message : copy.internal)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [ready, isTelegram])

  return (
    <AdminFrame title={copy.admin.users}>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {loading ? <RowsListSkeleton rows={8} /> : null}

      {!loading && users && users.length === 0 && !error ? (
        <p className={`${panelClass} text-sm text-(--tg-theme-hint-color)`}>{copy.admin.usersEmpty}</p>
      ) : null}

      {!loading && users && users.length > 0 ? (
        <ul className={`${panelClass} divide-y divide-(--surface-border) p-0`}>
          {users.map((user) => (
            <li key={user.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold tracking-tight">
                  {user.firstName || user.username || `id ${user.id}`}
                </span>
                <span className="mt-0.5 block text-xs text-(--tg-theme-hint-color)">
                  {user.username ? `@${user.username}` : "без username"} · {user.id}
                </span>
              </span>
              <span className="shrink-0 text-xs text-(--tg-theme-hint-color)">{formatVisit(user.lastVisit)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </AdminFrame>
  )
}
