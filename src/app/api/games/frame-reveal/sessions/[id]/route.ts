import { authenticate } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getRevealSessionForUser } from "@/lib/game/frame-reveal"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isUuid } from "@/lib/uuid"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "frameReveal")
    if (limited) return limited

    const id = (await context.params).id
    if (!isUuid(id)) return jsonError(copy.validation, 400)

    const session = await getRevealSessionForUser(auth.user.id, id)
    if (!session) return jsonError(copy.notFound, 404)
    return Response.json({ session })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
