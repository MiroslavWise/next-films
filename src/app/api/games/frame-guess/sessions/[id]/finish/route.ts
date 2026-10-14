import { authenticate } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { finishSession, frameGuessFinishBodySchema } from "@/lib/game/frame-guess"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isUuid } from "@/lib/uuid"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "frameGuess")
    if (limited) return limited

    const id = (await context.params).id
    if (!isUuid(id)) return jsonError(copy.validation, 400)

    const parsed = frameGuessFinishBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400)

    const result = await finishSession(auth.user.id, id, parsed.data.action)
    if (!result.ok) {
      if (result.error === "insufficient") {
        return Response.json({
          insufficient: true,
          entries: result.available?.entries ?? 0,
          movies: result.available?.movies ?? 0,
        })
      }
      if (result.status === 404) return jsonError(copy.notFound, 404)
      if (result.status === 409) return jsonError(copy.validation, 409)
      return jsonError(copy.validation, result.status)
    }

    return Response.json({ ok: true, action: result.action, session: result.session })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
