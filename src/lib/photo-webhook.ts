import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

const uuid = z.string().uuid({ version: "v7" })

const photoWebhookBodySchema = z.object({
  ok: z.boolean(),
  jobId: z.string().min(1).optional(),
  entityId: uuid.optional(),
  kind: z.enum(["poster", "portrait", "frame"]).optional(),
  movieId: uuid.nullable().optional(),
  url: z.url().optional(),
  blurhash: z.string().min(6).max(200).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

export type PhotoWebhookBody = z.infer<typeof photoWebhookBodySchema>

export function photoWebhookSecret() {
  return process.env.PHOTO_WEBHOOK_SECRET?.trim() || ""
}

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex")
    const right = Buffer.from(b, "hex")
    if (left.length === 0 || left.length !== right.length) return false
    return timingSafeEqual(left, right)
  } catch {
    return false
  }
}

function safeEqualText(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length === 0 || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** Bearer + optional HMAC `hex(HMAC-SHA256(secret, timestamp + "." + rawBody))`. */
export function verifyPhotoWebhook(request: Request, rawBody: string) {
  const secret = photoWebhookSecret()
  if (!secret) {
    return { ok: false as const, status: 500, error: "PHOTO_WEBHOOK_SECRET не настроен" }
  }

  const auth = request.headers.get("authorization")?.trim() || ""
  const expected = `Bearer ${secret}`
  if (!safeEqualText(auth, expected)) {
    return { ok: false as const, status: 401, error: "unauthorized" }
  }

  const signature = request.headers.get("x-signature")?.trim() || ""
  const timestamp = request.headers.get("x-timestamp")?.trim() || ""
  if (signature) {
    if (!timestamp || !/^\d+$/.test(timestamp)) {
      return { ok: false as const, status: 401, error: "invalid_timestamp" }
    }
    const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
    if (ageSec > 60 * 5) {
      return { ok: false as const, status: 401, error: "timestamp_expired" }
    }
    const mac = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex")
    if (!safeEqualHex(signature.toLowerCase(), mac)) {
      return { ok: false as const, status: 401, error: "invalid_signature" }
    }
  }

  return { ok: true as const }
}

export function parsePhotoWebhookBody(raw: unknown) {
  return photoWebhookBodySchema.safeParse(raw)
}
