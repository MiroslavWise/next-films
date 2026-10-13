import { copy } from "@/lib/constants";
import { deletePerson, updatePerson } from "@/lib/catalog";
import { authenticateAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { personBodySchema, personKindSchema } from "@/lib/validators";

type Context = { params: Promise<{ kind: string; id: string }> };

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const params = await context.params;
    const kind = personKindSchema.safeParse(params.kind);
    if (!kind.success || !uuidRe.test(params.id)) return jsonError(copy.validation, 400);
    const parsed = personBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400);
    const result = await updatePerson(
      kind.data,
      params.id,
      parsed.data.name,
      parsed.data.photoUrl,
      parsed.data.photoBlurhash,
    );
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json({ person: result.person });
  } catch {
    return jsonError(copy.internal, 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const params = await context.params;
    const kind = personKindSchema.safeParse(params.kind);
    if (!kind.success || !uuidRe.test(params.id)) return jsonError(copy.validation, 400);
    const result = await deletePerson(kind.data, params.id);
    if (!result.ok) return jsonError(result.error, result.status);
    return Response.json({ ok: true });
  } catch {
    return jsonError(copy.internal, 500);
  }
}
