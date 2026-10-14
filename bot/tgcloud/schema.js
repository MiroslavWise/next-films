import { table, integer, text, index } from "sdk/db"

export const profiles = table(
  "profiles",
  {
    id: integer("id").primaryKey(),
    username: text("username"),
    firstName: text("first_name"),
    lastVisit: integer("last_visit", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    lastVisitIdx: index("idx_profiles_last_visit").on(t.lastVisit),
  }),
)
