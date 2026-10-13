import { blobStoreOrigin, blobToken } from "@/lib/photos"

type Params = { path: string[] }

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  try {
    const token = blobToken()
    const origin = blobStoreOrigin(token)
    if (!token || !origin) {
      return new Response("Not configured", { status: 503 })
    }

    const { path } = await context.params
    if (!path?.length || path.some((segment) => segment.includes("..") || segment.includes("\\"))) {
      return new Response("Bad path", { status: 400 })
    }

    const pathname = path.map(encodeURIComponent).join("/")
    const upstream = await fetch(`${origin}/${pathname}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "force-cache",
    })

    if (!upstream.ok || !upstream.body) {
      return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 })
    }

    const headers = new Headers()
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream")
    headers.set("Cache-Control", "public, max-age=31536000, immutable")
    const length = upstream.headers.get("content-length")
    if (length) headers.set("Content-Length", length)

    return new Response(upstream.body, { status: 200, headers })
  } catch {
    return new Response("Error", { status: 500 })
  }
}
