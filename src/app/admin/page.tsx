"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { copy } from "@/lib/constants"
import { ApiRequestError, api } from "@/lib/api-client"
import { useTelegram } from "@/lib/telegram/use-telegram"

const links = [
  { href: "/admin/movies", label: copy.admin.movies },
  { href: "/admin/actors", label: copy.admin.actors },
  { href: "/admin/directors", label: copy.admin.directors },
  { href: "/admin/producers", label: copy.admin.producers },
  { href: "/admin/genres", label: copy.admin.genres },
]

export default function AdminPage() {
  const { ready } = useTelegram()
  const [state, setState] = useState<"loading" | "ok" | "denied" | "telegram">("loading")

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void api("/api/admin/movies", { signal: controller.signal })
        .then(() => setState("ok"))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          if (error instanceof ApiRequestError && error.status === 403) setState("denied")
          else setState("telegram")
        })
    }, 0)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [ready])

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-semibold tracking-tight">{copy.admin.title}</h1>
      {state === "loading" ? <p className="text-sm text-(--tg-theme-hint-color)">{copy.loading}</p> : null}
      {state === "denied" ? <p>{copy.admin.noAccess}</p> : null}
      {state === "telegram" ? <p>{copy.openInTelegram}</p> : null}
      {state === "ok" ? (
        <nav className="grid gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-3xl bg-(--tg-theme-secondary-bg-color) px-5 py-4 text-base font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </main>
  )
}
