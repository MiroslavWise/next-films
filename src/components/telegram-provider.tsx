"use client"

import { backButton, hapticFeedback, init, initData, mainButton, miniApp, retrieveRawInitData, themeParams, viewport } from "@tma.js/sdk"
import { type ReactNode, useEffect } from "react"
import { ensureSession } from "@/lib/api-client"
import { useSessionStore } from "@/lib/store/session"

const cssMap = [
  ["bgColor", "--tg-theme-bg-color"],
  ["textColor", "--tg-theme-text-color"],
  ["hintColor", "--tg-theme-hint-color"],
  ["linkColor", "--tg-theme-link-color"],
  ["buttonColor", "--tg-theme-button-color"],
  ["buttonTextColor", "--tg-theme-button-text-color"],
  ["secondaryBgColor", "--tg-theme-secondary-bg-color"],
] as const

function available(fn: { isAvailable?: () => boolean } | undefined) {
  try {
    return fn?.isAvailable?.() ?? true
  } catch {
    return false
  }
}

function applyThemeFromSdk() {
  const root = document.documentElement
  try {
    root.dataset.theme = miniApp.isDark() ? "dark" : "light"
  } catch {
    root.dataset.theme = "light"
  }
  for (const [key, cssVar] of cssMap) {
    try {
      const value = themeParams[key]()
      if (value) root.style.setProperty(cssVar, value)
    } catch {
      // ignore missing theme key
    }
  }
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const setBoot = useSessionStore((state) => state.setBoot)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      let rawInitData = ""
      let isTelegram = false
      let colorScheme: "light" | "dark" = "light"

      try {
        init()
        initData.restore()
        if (available(themeParams.mount)) themeParams.mount()
        if (available(miniApp.mount)) miniApp.mount()
        if (available(viewport.mount)) {
          await viewport.mount()
          if (available(viewport.expand)) viewport.expand()
        }
        if (available(mainButton.mount)) mainButton.mount()
        if (available(backButton.mount)) backButton.mount()
        if (available(miniApp.ready)) miniApp.ready()
        applyThemeFromSdk()
        rawInitData = retrieveRawInitData() ?? initData.raw() ?? ""
        isTelegram = rawInitData.length > 0
        colorScheme = miniApp.isDark() ? "dark" : "light"
      } catch {
        // Outside Telegram — mock session in development.
      }

      if (cancelled) return
      setBoot({
        ready: true,
        initData: rawInitData,
        isTelegram,
        colorScheme,
      })

      try {
        await ensureSession()
      } catch {
        // Pages surface API errors themselves.
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [setBoot])

  return children
}

export function useTelegramUi() {
  const ready = useSessionStore((state) => state.ready)
  const isTelegram = useSessionStore((state) => state.isTelegram)
  const colorScheme = useSessionStore((state) => state.colorScheme)
  const user = useSessionStore((state) => state.user)

  return {
    ready,
    isTelegram,
    colorScheme,
    user,
    haptic: (type: "success" | "error") => {
      try {
        if (available(hapticFeedback.notificationOccurred)) {
          hapticFeedback.notificationOccurred(type)
        }
      } catch {
        // ignore
      }
    },
    mainButton,
    backButton,
  }
}
