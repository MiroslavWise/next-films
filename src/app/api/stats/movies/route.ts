import { copy } from "@/lib/constants"
import { jsonError } from "@/lib/http"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const total = await prisma.movie.count()
    return Response.json(
      { total },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=60",
        },
      },
    )
  } catch {
    return jsonError(copy.internal, 500)
  }
}
