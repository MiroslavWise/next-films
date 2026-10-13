import { copy } from "@/lib/constants";
import { createGenre, listGenres } from "@/lib/catalog";
import { authenticateAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { genreBodySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    return Response.json({ genres: await listGenres() });
  } catch {
    return jsonError(copy.internal, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const parsed = genreBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400);
    const result = await createGenre(parsed.data.name);
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json({ genre: result.genre });
  } catch {
    return jsonError(copy.internal, 500);
  }
}
