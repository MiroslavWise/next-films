import { authenticate, upsertTelegramUser } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getOrCreateTournament } from "@/lib/game/movie-playoff"
import { jsonError } from "@/lib/http"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const limited = await enforceRateLimit(request, auth.user.id, "playoff")
    if (limited) return limited

    await upsertTelegramUser({
      id: auth.user.id,
      username: auth.user.username,
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
    })

    const result = await getOrCreateTournament(auth.user.id)
    if (!result.ok) {
      return Response.json({ insufficient: true, available: result.available })
    }

    return Response.json({ tournament: result.tournament, resumed: result.resumed })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
