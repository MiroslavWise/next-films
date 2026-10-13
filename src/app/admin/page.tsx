"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { FormMessage } from "@/components/admin/admin-frame"
import { panelClass } from "@/lib/ui"
import { copy } from "@/lib/constants"
import { ApiRequestError, api } from "@/lib/api-client"
import { useBackNavigation } from "@/lib/telegram/use-back-navigation"
import { useTelegram } from "@/lib/telegram/use-telegram"

const links = [
  { href: "/admin/movies", label: copy.admin.movies, hint: "Постеры, жанры и состав" },
  { href: "/admin/actors", label: copy.admin.actors, hint: "Актёрский состав" },
  { href: "/admin/directors", label: copy.admin.directors, hint: "Режиссёры" },
  { href: "/admin/producers", label: copy.admin.producers, hint: "Продюсеры" },
  { href: "/admin/genres", label: copy.admin.genres, hint: "Справочник жанров" },
]

export default function AdminPage() {
  const { ready, isTelegram } = useTelegram()
  const [state, setState] = useState<"loading" | "ok" | "denied" | "telegram">("loading")
  useBackNavigation("/")

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
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5">
      {!isTelegram ? (
        <Link href="/" className="text-sm text-(--tg-theme-hint-color) transition-colors hover:text-(--tg-theme-text-color)">
          ← {copy.backHome}
        </Link>
      ) : null}
      <header className="border-b border-(--surface-border) pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.admin.title}</h1>
        <p className="mt-1 text-sm text-(--tg-theme-hint-color)">Каталог фильмов и людей</p>
      </header>
      {state === "loading" ? <p className="text-sm text-(--tg-theme-hint-color)">{copy.loading}</p> : null}
      {state === "denied" ? <FormMessage tone="error">{copy.admin.noAccess}</FormMessage> : null}
      {state === "telegram" ? <FormMessage tone="error">{copy.openInTelegram}</FormMessage> : null}
      {state === "ok" ? (
        <nav className={`${panelClass} divide-y divide-(--surface-border) p-0`}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[color-mix(in_srgb,var(--tg-theme-button-color)_6%,transparent)]"
            >
              <span>
                <span className="block text-base font-semibold tracking-tight">{link.label}</span>
                <span className="mt-0.5 block text-xs text-(--tg-theme-hint-color)">{link.hint}</span>
              </span>
              <span aria-hidden className="text-(--tg-theme-hint-color)">
                ›
              </span>
            </Link>
          ))}
        </nav>
      ) : null}
    </main>
  )
}
