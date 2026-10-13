import { userFromSessionToken } from "@/lib/session-claims"
import { useSessionStore } from "@/lib/store/session"
import type { SessionResponse } from "@/types/api"

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function requestSession(initData: string) {
  const headers = new Headers()
  if (initData) headers.set("x-telegram-init-data", initData)
  const response = await fetch("/api/auth/session", { method: "POST", headers })
  const data = (await response.json().catch(() => null)) as SessionResponse & { error?: string }
  if (!response.ok) {
    throw new ApiRequestError(data?.error ?? "Ошибка авторизации", response.status)
  }
  const user = userFromSessionToken(data.token, data.user) ?? data.user
  useSessionStore.getState().setSession(data.token, user)
  return data.token
}

export async function ensureSession() {
  const state = useSessionStore.getState()
  if (state.sessionToken) return state.sessionToken
  return requestSession(state.initData)
}

export async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = await ensureSession()
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(path, { ...init, headers })
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  if (response.status === 401 && retry) {
    useSessionStore.getState().clearSession()
    await requestSession(useSessionStore.getState().initData)
    return api(path, init, false)
  }
  if (!response.ok) {
    throw new ApiRequestError(data?.error ?? "Ошибка запроса", response.status)
  }
  return data as T
}

export async function uploadPhoto(file: File, kind: "poster" | "portrait", entityId?: string) {
  const body = new FormData()
  body.set("file", file)
  body.set("kind", kind)
  if (entityId) body.set("entityId", entityId)
  return api<{ url: string; blurhash: string; entityId: string }>("/api/admin/photos", { method: "POST", body })
}
