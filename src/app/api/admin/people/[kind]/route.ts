import { copy } from "@/lib/constants";
import { createPerson, listPeople } from "@/lib/catalog";
import { authenticateAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { personBodySchema, personKindSchema } from "@/lib/validators";

type Context = { params: Promise<{ kind: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const kind = personKindSchema.safeParse((await context.params).kind);
    if (!kind.success) return jsonError(copy.notFound, 404);
    return Response.json({ people: await listPeople(kind.data) });
  } catch {
    return jsonError(copy.internal, 500);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authenticateAdmin(request);
    if (!auth.ok) return auth.response;
    const kind = personKindSchema.safeParse((await context.params).kind);
    if (!kind.success) return jsonError(copy.notFound, 404);
    const parsed = personBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400);
    const result = await createPerson(
      kind.data,
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
