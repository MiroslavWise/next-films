import { copy } from "@/lib/constants";
import { authenticate } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getRound } from "@/lib/game/movie-choice";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;
    const limited = await enforceRateLimit(request, auth.user.id, "round");
    if (limited) return limited;
    return Response.json(await getRound(auth.user.id));
  } catch {
    return jsonError(copy.internal, 500);
  }
}
