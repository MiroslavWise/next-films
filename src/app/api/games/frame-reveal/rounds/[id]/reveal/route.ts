import { authenticate } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { revealCell } from "@/lib/game/frame-reveal"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isUuid } from "@/lib/uuid"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "frameReveal")
    if (limited) return limited

    const id = (await context.params).id
    if (!isUuid(id)) return jsonError(copy.validation, 400)

    const result = await revealCell(auth.user.id, id)
    if (!result.ok) {
      if (result.status === 404) return jsonError(copy.notFound, 404)
      if (result.status === 409) return jsonError(copy.validation, 409)
      return jsonError(copy.validation, result.status)
    }

    return Response.json({ round: result.round })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
