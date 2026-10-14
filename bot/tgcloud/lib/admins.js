// Keep in sync with NEXT_ADMIN_IDS in the Next.js app (.env / Vercel).
// Telegram Serverless has no process.env for app secrets.
export const ADMIN_IDS = [934719495]

export function isAdmin(userId) {
  const id = typeof userId === "string" ? Number(userId) : userId
  return ADMIN_IDS.includes(id)
}
