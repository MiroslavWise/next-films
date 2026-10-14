import { authenticate } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getCurrentTournament } from "@/lib/game/movie-playoff"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "playoff")
    if (limited) return limited

    const tournament = await getCurrentTournament(auth.user.id)
    if (!tournament) return jsonError(copy.notFound, 404)
    return Response.json({ tournament })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
