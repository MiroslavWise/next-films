import { authenticate, upsertTelegramUser } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { applyPick, playoffPickBodySchema } from "@/lib/game/movie-playoff"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"

type Context = { params: Promise<{ id: string }> }

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PUT(request: Request, context: Context) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "playoff")
    if (limited) return limited

    const { id } = await context.params
    if (!uuidRe.test(id)) return jsonError(copy.validation, 400)

    const parsed = playoffPickBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400)
    }

    await upsertTelegramUser({
      id: auth.user.id,
      username: auth.user.username,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
    })

    const result = await applyPick(auth.user.id, id, parsed.data)
    if (!result.ok) {
      if (result.status === 409) return jsonError(copy.playoffConflict, 409)
      if (result.status === 404) return jsonError(copy.notFound, 404)
      return jsonError(copy.validation, result.status)
    }

    return Response.json({ tournament: result.tournament })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
