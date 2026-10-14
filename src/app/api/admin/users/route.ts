import { authenticateAdmin } from "@/lib/auth"
import { copy } from "@/lib/constants"
import { jsonError } from "@/lib/http"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const auth = await authenticateAdmin(request)
    if (!auth.ok) return auth.response

    const rows = await prisma.telegramUser.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 500,
    })

    return Response.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        firstName: row.firstName,
        lastVisit: row.lastSeenAt.toISOString(),
      })),
    })
  } catch {
    return jsonError(copy.internal, 500)
  }
}
