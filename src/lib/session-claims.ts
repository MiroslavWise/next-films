import { decodeJwt } from "jose"
import type { SessionUser } from "@/types/api"

/** Читает claims из JWT без проверки подписи — только для UI. API всё равно проверяет токен на сервере. */
export function userFromSessionToken(token: string, fallback?: SessionUser | null): SessionUser | null {
  try {
    const payload = decodeJwt(token)
    if (typeof payload.sub !== "string" || !payload.sub) return fallback ?? null
    return {
      id: payload.sub,
      username: typeof payload.username === "string" ? payload.username : fallback?.username,
      firstName: typeof payload.firstName === "string" ? payload.firstName : fallback?.firstName,
      lastName: typeof payload.lastName === "string" ? payload.lastName : fallback?.lastName,
      isAdmin: payload.isAdmin === true,
    }
  } catch {
    return fallback ?? null
  }
}
