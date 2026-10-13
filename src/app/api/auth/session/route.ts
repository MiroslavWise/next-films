import { copy } from "@/lib/constants"
import { jsonError } from "@/lib/http"
import { createSession } from "@/lib/auth"
import { enforceRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const initData = request.headers.get("x-telegram-init-data")?.trim() ?? ""
    const limited = await enforceRateLimit(request, null, "round")
    if (limited) return limited

    const result = await createSession(initData)
    if (!result.ok) return result.response
    return Response.json(result.session)
  } catch {
    return jsonError(copy.internal, 500)
  }
}
