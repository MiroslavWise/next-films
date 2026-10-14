import { authenticateAdmin } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { appendFrameGuessFrame } from "@/lib/frame-guess"
import { jsonError } from "@/lib/http"
import { deleteStoredPhoto, storePhoto } from "@/lib/photos"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isUuid, uuidv7 } from "@/lib/uuid"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "photo")
    if (limited) return limited

    const movieId = (await context.params).id
    if (!isUuid(movieId)) return jsonError(copy.validation, 400)

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return jsonError(copy.validation, 400)

    const frameId = uuidv7()
    const stored = await storePhoto(file, "frame", frameId, { movieId })
    if (!stored.ok) return jsonError(stored.error, stored.status)

    const result = await appendFrameGuessFrame(movieId, {
      id: stored.entityId,
      url: stored.url,
      blurhash: stored.blurhash,
    })
    if (!result.ok) {
      await deleteStoredPhoto(stored.url)
      return jsonError(result.error, result.status)
    }

    return Response.json({ entry: result.entry, frame: result.frame })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.includes("private store") || message.includes("public access")) {
      return jsonError("Хранилище настроено как private. Загрузка исправлена, обновите деплой.", 500)
    }
    console.error("[frame-guess frames]", error)
    return jsonError(copy.internal, 500)
  }
}
