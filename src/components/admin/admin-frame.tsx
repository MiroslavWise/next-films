"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { copy } from "@/lib/constants"
import { useBackNavigation } from "@/lib/telegram/use-back-navigation"
import { useTelegram } from "@/lib/telegram/use-telegram"

export const fieldClass =
  "h-11 w-full rounded-2xl border-0 bg-[var(--tg-theme-bg-color)] px-3 text-sm outline-none"

export const buttonClass =
  "inline-flex h-11 items-center justify-center rounded-full bg-[var(--tg-theme-button-color)] px-5 text-sm font-semibold text-[var(--tg-theme-button-text-color)] disabled:opacity-40"

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
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-5">
      {!isTelegram ? (
        <Link href={backHref} className="text-sm text-[var(--tg-theme-hint-color)]">
          ← {backLabel}
        </Link>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  )
}
