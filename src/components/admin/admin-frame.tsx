"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { copy } from "@/lib/constants"
import { useBackNavigation } from "@/lib/telegram/use-back-navigation"
import { useTelegram } from "@/lib/telegram/use-telegram"

export {
  buttonClass,
  dangerActionClass,
  fieldClass,
  ghostButtonClass,
  linkActionClass,
  panelClass,
} from "@/lib/ui"

export function AdminFrame({
  title,
  backHref = "/admin",
  backLabel = copy.admin.title,
  children,
}: {
  title: string
  backHref?: string
  backLabel?: string
  children: ReactNode
}) {
  const { isTelegram } = useTelegram()
  useBackNavigation(backHref)

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5">
      {!isTelegram ? (
        <Link href={backHref} className="text-sm text-(--tg-theme-hint-color) transition-colors hover:text-(--tg-theme-text-color)">
          ← {backLabel}
        </Link>
      ) : null}
      <header className="border-b border-(--surface-border) pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </header>
      {children}
    </main>
  )
}

export function FormMessage({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[var(--radius-sm)] px-3 py-2 text-sm ${
        tone === "error"
          ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-(--danger)"
          : "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-(--success)"
      }`}
    >
      {children}
    </p>
  )
}
