import { db, EndpointError } from "sdk"
import { desc } from "sdk/db"
import { isAdmin } from "../lib/admins.js"
import { profiles } from "../schema.js"

export default async function (_input, ctx) {
  const user = ctx.initData?.user
  if (!user?.id || !isAdmin(user.id)) {
    throw new EndpointError("Forbidden", { code: "FORBIDDEN" })
  }

  const rows = await db.select().from(profiles).orderBy(desc(profiles.lastVisit)).all()

  return {
    users: rows.map((row) => ({
      id: row.id,
      username: row.username ?? null,
      firstName: row.firstName ?? null,
      lastVisit: row.lastVisit instanceof Date ? row.lastVisit.toISOString() : row.lastVisit,
    })),
  }
}
