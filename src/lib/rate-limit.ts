import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { copy } from "@/lib/constants"
import { clientIp, jsonError } from "@/lib/http"

type Bucket = "round" | "vote" | "photo" | "playoff" | "frameGuess" | "frameReveal"

const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

const limits: Record<Bucket, number> = {
  round: 30,
  vote: 10,
  photo: 20,
  playoff: 40,
  frameGuess: 60,
  frameReveal: 80,
}

function redisClient() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = redisClient()

const limiters: Partial<Record<Bucket, Ratelimit>> = redis
  ? {
      round: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limits.round, "1 m"),
        prefix: "next-films:round",
      }),
      vote: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limits.vote, "1 m"),
        prefix: "next-films:vote",
      }),
      photo: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limits.photo, "1 m"),
        prefix: "next-films:photo",
      }),
      playoff: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limits.playoff, "1 m"),
        prefix: "next-films:playoff",
      }),
      frameGuess: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limits.frameGuess, "1 m"),
        prefix: "next-films:frame-guess",
      }),
      frameReveal: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limits.frameReveal, "1 m"),
        prefix: "next-films:frame-reveal",
      }),
    }
  : {}

function memoryLimit(key: string, limit: number) {
  const now = Date.now()
  const current = memoryBuckets.get(key)
  if (!current || current.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

export async function enforceRateLimit(request: Request, userId: string | null, bucket: Bucket) {
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      return jsonError("Ограничение запросов не настроено", 500)
    }
    const allowed = memoryLimit(`${bucket}:${userId ?? clientIp(request)}`, limits[bucket])
    return allowed ? null : jsonError(copy.rateLimited, 429)
  }

  const limiter = limiters[bucket]
  if (!limiter) return jsonError("Ограничение запросов не настроено", 500)

  const { success } = await limiter.limit(`${bucket}:${userId ?? clientIp(request)}`)
  return success ? null : jsonError(copy.rateLimited, 429)
}
