import { authenticate } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getTournamentForUser } from "@/lib/game/movie-playoff"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"

type Context = { params: Promise<{ id: string }> }

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "playoff")
    if (limited) return limited

    const { id } = await context.params
    if (!uuidRe.test(id)) return jsonError(copy.validation, 400)

    const tournament = await getTournamentForUser(auth.user.id, id)
    if (!tournament) return jsonError(copy.notFound, 404)
    return Response.json({ tournament })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
