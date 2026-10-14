import { authenticateAdmin } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { removeFrameGuessFrame } from "@/lib/frame-guess"
import { jsonError } from "@/lib/http"
import { isUuid } from "@/lib/uuid"

type Context = { params: Promise<{ id: string; frameId: string }> }

export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const { id: movieId, frameId } = await context.params
    if (!isUuid(movieId) || !isUuid(frameId)) return jsonError(copy.validation, 400)
    const result = await removeFrameGuessFrame(movieId, frameId)
    if (!result.ok) return jsonError(result.error, result.status)
    return Response.json({ entry: result.entry })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
