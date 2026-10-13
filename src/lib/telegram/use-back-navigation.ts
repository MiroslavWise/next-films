"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useTelegram } from "@/lib/telegram/use-telegram"

/** Показывает Telegram BackButton и ведёт на href; вне Telegram ничего не делает. */
export function useBackNavigation(href: string, enabled = true) {
  const router = useRouter()
  const { isTelegram, backButton } = useTelegram()

  useEffect(() => {
    if (!enabled || !isTelegram) return

    const go = () => router.push(href)
    try {
      backButton.show()
      backButton.onClick(go)
    } catch {
      return
    }

    return () => {
      try {
        backButton.offClick(go)
        backButton.hide()
      } catch {
        // ignore
      }
    }
  }, [enabled, isTelegram, href, router, backButton])
}
