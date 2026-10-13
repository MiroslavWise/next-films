import { ADMIN_MOVIES_PAGE_SIZE, copy } from "@/lib/constants"
import { createMovie, listMovies } from "@/lib/catalog"
import { authenticateAdmin } from "@/lib/auth"
import { jsonError } from "@/lib/http"
import { movieBodySchema } from "@/lib/validators"

export async function GET(request: Request) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const url = new URL(request.url)
    const page = Number(url.searchParams.get("page") || "1")
    const pageSize = Number(url.searchParams.get("pageSize") || String(ADMIN_MOVIES_PAGE_SIZE))
    return Response.json(
      await listMovies({
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : ADMIN_MOVIES_PAGE_SIZE,
      }),
    )
  } catch {
    return jsonError(copy.internal, 500)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response
    const parsed = movieBodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400)
    const result = await createMovie(parsed.data)
    if (!result.ok) return jsonError(result.error, result.status)
    return Response.json({ movie: result.movie })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
