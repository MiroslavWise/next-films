export function isBlobUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com")
  } catch {
    return false
  }
}

/** Stable app URL for private Blob objects (browser cannot call private store directly). */
export function mediaSrc(url: string | null | undefined) {
  if (!url) return ""
  if (!isBlobUrl(url)) return url
  try {
    const pathname = new URL(url).pathname.replace(/^\/+/, "")
    if (!pathname) return url
    return `/api/media/${pathname}`
  } catch {
    return url
  }
}
