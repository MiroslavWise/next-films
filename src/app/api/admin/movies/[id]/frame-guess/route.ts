import { z } from "zod"
import { authenticateAdmin } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { getFrameGuessEntry, setFrameGuessActive } from "@/lib/frame-guess"
import { jsonError } from "@/lib/http"
import { isUuid } from "@/lib/uuid"

type Context = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  isActive: z.boolean(),
})

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const movieId = (await context.params).id
    if (!isUuid(movieId)) return jsonError(copy.validation, 400)
    const result = await getFrameGuessEntry(movieId)
    if (!result.ok) return jsonError(result.error, result.status)
    return Response.json({ entry: result.entry })
  } catch {
    return jsonError(copy.internal, 500)
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const movieId = (await context.params).id
    if (!isUuid(movieId)) return jsonError(copy.validation, 400)
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400)
    const result = await setFrameGuessActive(movieId, parsed.data.isActive)
    if (!result.ok) return jsonError(result.error, result.status)
    return Response.json({ entry: result.entry })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
