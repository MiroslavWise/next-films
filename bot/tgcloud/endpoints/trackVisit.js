import { db } from "sdk"
import { profiles } from "../schema.js"

export default async function (_input, ctx) {
  const user = ctx.initData?.user
  if (!user?.id) return { ok: false }

  const now = new Date()
  await db
    .insert(profiles)
    .values({
      id: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastVisit: now,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        username: user.username ?? null,
        firstName: user.first_name ?? null,
        lastVisit: now,
      },
    })
    .run()

  return { ok: true }
}
