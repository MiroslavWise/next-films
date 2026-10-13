import { copy } from "@/lib/constants";
import { deleteMovie, updateMovie } from "@/lib/catalog";
import { authenticateAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { movieBodySchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function movieId(raw: string) {
  return uuidRe.test(raw) ? raw : null;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const id = movieId((await context.params).id);
    if (!id) return jsonError(copy.validation, 400);
    const parsed = movieBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400);
    const result = await updateMovie(id, parsed.data);
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json({ movie: result.movie });
  } catch {
    return jsonError(copy.internal, 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const id = movieId((await context.params).id);
    if (!id) return jsonError(copy.validation, 400);
    const result = await deleteMovie(id);
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json({ ok: true });
  } catch {
    return jsonError(copy.internal, 500);
  }
}
