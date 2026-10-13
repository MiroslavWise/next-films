import { del, put } from "@vercel/blob";
import { encode } from "blurhash";
import sharp from "sharp";
import {
  AVIF_QUALITY,
  BLURHASH_X,
  BLURHASH_Y,
  MAX_UPLOAD_BYTES,
  PORTRAIT_MAX_WIDTH,
  POSTER_MAX_WIDTH,
  copy,
} from "@/lib/constants";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

export function isBlobUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || ""
}

export async function deleteStoredPhoto(url: string | null | undefined) {
  if (!url || !isBlobUrl(url)) return
  const token = blobToken()
  if (!token) return
  await del(url, { token })
}

export async function storePhoto(file: File, kind: "poster" | "portrait") {
  const token = blobToken()
  if (!token) {
    return { ok: false as const, status: 500, error: "Хранилище фотографий не настроено" }
  }
  if (!allowedTypes.has(file.type)) {
    return { ok: false as const, status: 400, error: copy.admin.photoType };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false as const, status: 400, error: copy.admin.photoTooLarge };
  }

  const width = kind === "poster" ? POSTER_MAX_WIDTH : PORTRAIT_MAX_WIDTH;
  const input = Buffer.from(await file.arrayBuffer());
  const base = sharp(input).rotate().resize({ width, withoutEnlargement: true });

  const { data, info } = await base
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, BLURHASH_X, BLURHASH_Y);
  const avif = await base.avif({ quality: AVIF_QUALITY }).toBuffer();

  const folder = kind === "poster" ? "posters" : "people";
  const blob = await put(`${folder}/${crypto.randomUUID()}.avif`, avif, {
    access: "public",
    contentType: "image/avif",
    token,
  })

  return { ok: true as const, url: blob.url, blurhash }
}
