import { parse, validate } from "@tma.js/init-data-node"
import { INIT_DATA_MAX_AGE_SECONDS, copy } from "@/lib/constants"

export type TelegramUser = {
  id: string
  username?: string
  firstName?: string
  lastName?: string
  languageCode?: string
}

type ValidateResult = { ok: true; user: TelegramUser } | { ok: false; status: 401; error: string }

export function validateInitData(initData: string): ValidateResult {
  const botToken = process.env.NEXT_BOT_TOKEN
  if (!botToken) {
    return { ok: false, status: 401, error: copy.invalidInitData }
  }

  try {
    validate(initData, botToken, { expiresIn: INIT_DATA_MAX_AGE_SECONDS })
  } catch {
    return { ok: false, status: 401, error: copy.invalidInitData }
  }

  try {
    const parsed = parse(initData)
    if (!parsed.user?.id) {
      return { ok: false, status: 401, error: copy.invalidInitData }
    }
    return {
      ok: true,
      user: {
        id: String(parsed.user.id),
        username: parsed.user.username,
        firstName: parsed.user.first_name,
        lastName: parsed.user.last_name,
        languageCode: parsed.user.language_code,
      },
    }
  } catch {
    return { ok: false, status: 401, error: copy.invalidInitData }
  }
}

export function mockTelegramUser(): TelegramUser {
  const adminId = process.env.NEXT_ADMIN_IDS?.split(",")[0]?.trim()
  return {
    id: adminId || "1234567890",
    username: "dev",
    firstName: "Тест",
    languageCode: "ru",
  }
}

export function isMockTelegramEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.MOCK_TELEGRAM_USER === "true"
}
