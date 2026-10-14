import { del, put } from "@vercel/blob"
import { encode } from "blurhash"
import sharp from "sharp"
import {
  AVIF_EFFORT,
  AVIF_QUALITY,
  BLURHASH_X,
  BLURHASH_Y,
  FRAME_BLURHASH_X,
  FRAME_BLURHASH_Y,
  FRAME_MAX_WIDTH,
  MAX_UPLOAD_BYTES,
  PORTRAIT_MAX_WIDTH,
  POSTER_MAX_WIDTH,
  copy,
} from "@/lib/constants"
import { isBlobUrl } from "@/lib/media"
import { isUuid, uuidv7 } from "@/lib/uuid"

export { isBlobUrl, mediaSrc } from "@/lib/media"

const allowedTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/avif",
  "image/gif",
])

export function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || ""
}

export function blobStoreOrigin(token = blobToken()) {
  const match = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)
  if (!match?.[1]) return null
  return `https://${match[1].toLowerCase()}.private.blob.vercel-storage.com`
}

function photoProcessorUrl() {
  return process.env.PHOTO_PROCESSOR_URL?.trim().replace(/\/$/, "") || ""
}

function photoProcessorToken() {
  return process.env.PHOTO_PROCESSOR_TOKEN?.trim() || ""
}

export async function deleteStoredPhoto(url: string | null | undefined) {
  if (!url || !isBlobUrl(url)) return
  const token = blobToken()
  if (!token) return
  await del(url, { token })
}

/** Telegram / часть ОС отдают PNG без нормального MIME — смотрим magic bytes и расширение. */
function detectImageMime(buffer: Buffer, declaredType: string, fileName: string) {
  const mime = declaredType.trim().toLowerCase()
  if (allowedTypes.has(mime)) {
    return mime === "image/jpg" || mime === "image/pjpeg" ? "image/jpeg" : mime === "image/x-png" ? "image/png" : mime
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png"
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  if (buffer.length >= 6) {
    const head = buffer.toString("ascii", 0, 6)
    if (head === "GIF87a" || head === "GIF89a") return "image/gif"
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12)
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif"
  }

  const name = fileName.toLowerCase()
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".gif")) return "image/gif"
  if (name.endsWith(".avif")) return "image/avif"

  return null
}

export type PhotoKind = "poster" | "portrait" | "frame"

type StorePhotoResult =
  | { ok: true; url: string; blurhash: string; entityId: string }
  | { ok: false; status: number; error: string }

type ProcessorResponse = {
  ok?: boolean
  entityId?: string
  url?: string
  blurhash?: string
  error?: string
  message?: string
}

async function storePhotoViaProcessor(
  file: File,
  kind: PhotoKind,
  entityId: string,
  movieId: string | null,
): Promise<StorePhotoResult> {
  const base = photoProcessorUrl()
  const token = photoProcessorToken()
  if (!base || !token) {
    return { ok: false, status: 500, error: "Photo processor не настроен" }
  }

  const body = new FormData()
  body.set("file", file)
  body.set("kind", kind)
  body.set("entityId", entityId)
  if (movieId) body.set("movieId", movieId)

  let response: Response
  try {
    response = await fetch(`${base}/v1/process`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    console.error("[photos] processor fetch", error)
    return { ok: false, status: 502, error: "Не удалось связаться с photo processor" }
  }

  const data = (await response.json().catch(() => null)) as ProcessorResponse | null
  if (!response.ok || !data?.ok || !data.url || !data.blurhash || !data.entityId) {
    const message = data?.message || data?.error || copy.internal
    console.error("[photos] processor error", response.status, data)
    return {
      ok: false,
      status: response.status >= 400 && response.status < 600 ? response.status : 500,
      error: typeof message === "string" ? message : copy.internal,
    }
  }

  return { ok: true, url: data.url, blurhash: data.blurhash, entityId: data.entityId }
}

async function storePhotoLocal(
  file: File,
  kind: PhotoKind,
  entityId: string,
  movieId: string | null,
): Promise<StorePhotoResult> {
  const token = blobToken()
  if (!token) {
    return { ok: false, status: 500, error: "Хранилище фотографий не настроено" }
  }

  const width = kind === "poster" ? POSTER_MAX_WIDTH : kind === "frame" ? FRAME_MAX_WIDTH : PORTRAIT_MAX_WIDTH
  const blurX = kind === "frame" ? FRAME_BLURHASH_X : BLURHASH_X
  const blurY = kind === "frame" ? FRAME_BLURHASH_Y : BLURHASH_Y
  const input = Buffer.from(await file.arrayBuffer())
  const detected = detectImageMime(input, file.type || "", file.name || "")
  if (!detected) {
    return { ok: false, status: 400, error: copy.admin.photoType }
  }

  const base = sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: "inside" })
    .removeAlpha()

  const { data, info } = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, blurX, blurY)
  const avif = await base
    .avif({
      quality: AVIF_QUALITY,
      effort: AVIF_EFFORT,
      chromaSubsampling: "4:2:0",
    })
    .toBuffer()

  const pathname =
    kind === "frame" && movieId
      ? `frame-guess/${movieId}/${entityId}.avif`
      : kind === "poster"
        ? `posters/${entityId}.avif`
        : `people/${entityId}.avif`
  const blob = await put(pathname, avif, {
    access: "private",
    contentType: "image/avif",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return { ok: true, url: blob.url, blurhash, entityId }
}

export async function storePhoto(
  file: File,
  kind: PhotoKind,
  entityId?: string | null,
  options?: { movieId?: string | null },
): Promise<StorePhotoResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 400, error: copy.admin.photoTooLarge }
  }

  const id = entityId && isUuid(entityId) ? entityId : uuidv7()
  const movieId = options?.movieId && isUuid(options.movieId) ? options.movieId : null
  if (kind === "frame" && !movieId) {
    return { ok: false, status: 400, error: copy.validation }
  }

  if (photoProcessorUrl() && photoProcessorToken()) {
    return storePhotoViaProcessor(file, kind, id, movieId)
  }

  return storePhotoLocal(file, kind, id, movieId)
}
