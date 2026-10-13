"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminFrame, FormMessage } from "@/components/admin/admin-frame"
import { RowsListSkeleton } from "@/components/admin/admin-skeletons"
import { adminKeys, usePeoplePageQuery } from "@/lib/admin-queries"
import { ApiRequestError, api } from "@/lib/api-client"
import { ADMIN_ACTORS_PAGE_SIZE, copy } from "@/lib/constants"
import { buttonClass, dangerActionClass, ghostButtonClass, linkActionClass, panelClass } from "@/lib/ui"
import type { PersonRecord } from "@/types/api"

export function ActorList() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const peopleQuery = usePeoplePageQuery("actors", page, ADMIN_ACTORS_PAGE_SIZE)

  const deleteMutation = useMutation({
    mutationFn: (person: PersonRecord) => api(`/api/admin/people/actors/${person.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.people("actors") })
    },
  })

  async function onDelete(person: PersonRecord) {
    if (!window.confirm(`${copy.admin.delete}: ${person.name}?`)) return
    setError("")
    setMessage("")
    try {
      await deleteMutation.mutateAsync(person)
      setMessage(copy.admin.deleted)
      const remaining = peopleQuery.data?.people.length ?? 0
      if (remaining <= 1 && page > 1) setPage((value) => value - 1)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal)
    }
  }

  const peoplePage = peopleQuery.data
  const loadError = peopleQuery.isError
    ? peopleQuery.error instanceof ApiRequestError
      ? peopleQuery.error.message
      : copy.internal
    : ""

  return (
    <AdminFrame title={copy.admin.actors}>
      <Link href="/admin/actors/new" className={buttonClass}>
        {copy.admin.add}
      </Link>

      {message ? <FormMessage tone="ok">{message}</FormMessage> : null}
      {error || loadError ? <FormMessage tone="error">{error || loadError}</FormMessage> : null}
      {peopleQuery.isPending ? <RowsListSkeleton rows={8} /> : null}

      {peoplePage ? (
        <>
          <ul className={`${panelClass} divide-y divide-(--surface-border) p-0`}>
            {peoplePage.people.length === 0 ? (
              <li className="px-4 py-3 text-sm text-(--tg-theme-hint-color)">{copy.admin.emptyList}</li>
            ) : null}
            {peoplePage.people.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{person.name}</span>
                <span className="flex gap-4">
                  <Link href={`/admin/actors/${person.id}/edit`} className={linkActionClass}>
                    {copy.admin.edit}
                  </Link>
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

          {peoplePage.pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className={ghostButtonClass}
                disabled={page <= 1 || deleteMutation.isPending}
                onClick={() => setPage((value) => value - 1)}
              >
                {copy.admin.prevPage}
              </button>
              <p className="text-sm text-(--tg-theme-hint-color)">
                {copy.admin.pageOf} {peoplePage.page} / {peoplePage.pageCount}
              </p>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={page >= peoplePage.pageCount || deleteMutation.isPending}
                onClick={() => setPage((value) => value + 1)}
              >
                {copy.admin.nextPage}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminFrame>
  )
}
