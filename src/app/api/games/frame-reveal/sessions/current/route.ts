import { authenticate } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getCurrentRevealSession } from "@/lib/game/frame-reveal"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "frameReveal")
    if (limited) return limited

    const current = await getCurrentRevealSession(auth.user.id)
    if (!current) return jsonError(copy.notFound, 404)
    if (!current.ok) {
      return Response.json({
        insufficient: true,
        entries: current.available.entries,
        movies: current.available.movies,
        session: current.session,
      })
    }

    return Response.json({ session: current.session })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
