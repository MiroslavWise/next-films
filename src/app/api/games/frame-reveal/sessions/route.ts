import { authenticate, upsertTelegramUser } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getOrCreateRevealSession, listEndedRevealSessions } from "@/lib/game/frame-reveal"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "frameReveal")
    if (limited) return limited

    const sessions = await listEndedRevealSessions(auth.user.id)
    return Response.json({ sessions })
  } catch {
    return jsonError(copy.internal, 500)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "frameReveal")
    if (limited) return limited

    await upsertTelegramUser({
      id: auth.user.id,
      username: auth.user.username,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
    })

    const result = await getOrCreateRevealSession(auth.user.id)
    if (!result.ok) {
      const available = result.available ?? { entries: 0, movies: 0 }
      return Response.json({
        insufficient: true,
        entries: available.entries,
        movies: available.movies,
      })
    }

    return Response.json({ session: result.session, resumed: result.resumed })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
