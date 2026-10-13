import { copy } from "@/lib/constants";
import { authenticateAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { storePhoto } from "@/lib/photos";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const limited = await enforceRateLimit(request, auth.user.id, "photo");
    if (limited) return limited;

    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || (kind !== "poster" && kind !== "portrait")) {
      return jsonError(copy.validation, 400);
    }

    const stored = await storePhoto(file, kind);
    if (!stored.ok) return jsonError(stored.error, stored.status);
    return Response.json({ url: stored.url, blurhash: stored.blurhash });
  } catch {
    return jsonError(copy.internal, 500);
  }
}
