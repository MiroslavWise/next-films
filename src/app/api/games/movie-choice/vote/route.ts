import { copy } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { authenticate } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { submitVotes } from "@/lib/game/movie-choice";
import { voteBodySchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;
    const limited = await enforceRateLimit(request, auth.user.id, "vote");
    if (limited) return limited;

    const parsed = voteBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? copy.validation, 400);
    }

    const result = await submitVotes(auth.user.id, parsed.data.votes);
    if (!result.ok) return jsonError(copy.notFound, result.status);
    return Response.json({
      ok: true,
      processed: result.processed,
      skipped: result.skipped,
      next: result.next,
    });
  } catch {
    return jsonError(copy.internal, 500);
  }
}
