import { appendFrameGuessFrame } from "@/lib/frame-guess"
import { jsonError } from "@/lib/http"
import { parsePhotoWebhookBody, verifyPhotoWebhook } from "@/lib/photo-webhook"
import { isUuid } from "@/lib/uuid"

export const maxDuration = 60

export async function POST(request: Request) {
  const rawBody = await request.text()
  const auth = verifyPhotoWebhook(request, rawBody)
  if (!auth.ok) return jsonError(auth.error, auth.status)

  let json: unknown
  try {
    json = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return jsonError("invalid_json", 400)
  }

  const parsed = parsePhotoWebhookBody(json)
  if (!parsed.success) return jsonError("validation", 400)

  const body = parsed.data
  const jobId = body.jobId || request.headers.get("x-job-id")?.trim() || null

  if (!body.ok) {
    console.warn("[photo-webhook] failed job", { jobId, error: body.error, message: body.message })
    return Response.json({ ok: true, received: true, status: "failed", jobId })
  }

  if (body.kind === "frame") {
    const movieId = body.movieId
    if (!movieId || !isUuid(movieId) || !body.entityId || !body.url || !body.blurhash) {
      return jsonError("frame_payload_incomplete", 400)
    }

    const result = await appendFrameGuessFrame(movieId, {
      id: body.entityId,
      url: body.url,
      blurhash: body.blurhash,
    })
    if (!result.ok) return jsonError(result.error, result.status)

    return Response.json({
      ok: true,
      received: true,
      status: "done",
      jobId,
      kind: "frame",
      entityId: body.entityId,
      movieId,
    })
  }

  // poster/portrait: админка пишет в БД после sync-ответа; webhook только подтверждаем
  return Response.json({
    ok: true,
    received: true,
    status: "done",
    jobId,
    kind: body.kind ?? null,
    entityId: body.entityId ?? null,
  })
}
