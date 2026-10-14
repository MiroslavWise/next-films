import { copy } from "@/lib/constants"
import { authenticateAdmin } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { storePhoto } from "@/lib/photos"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isUuid } from "@/lib/uuid"

export const maxDuration = 120

export async function POST(request: Request) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "photo")
    if (limited) return limited

    const form = await request.formData()
    const file = form.get("file")
    const kind = form.get("kind")
    const entityIdRaw = form.get("entityId")
    const entityId = typeof entityIdRaw === "string" && isUuid(entityIdRaw) ? entityIdRaw : null

    if (!(file instanceof File) || (kind !== "poster" && kind !== "portrait")) {
      return jsonError(copy.validation, 400)
    }

    const stored = await storePhoto(file, kind, entityId)
    if (!stored.ok) return jsonError(stored.error, stored.status)
    return Response.json({ url: stored.url, blurhash: stored.blurhash, entityId: stored.entityId })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("private store") || message.includes("public access")) {
      return jsonError("Хранилище настроено как private. Загрузка исправлена, обновите деплой.", 500)
    }
    console.error("[photos]", error)
    return jsonError(copy.internal, 500)
  }
}
