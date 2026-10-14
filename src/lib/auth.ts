import { copy } from "@/lib/constants";
import { jsonError } from "@/lib/http";
import { signSessionToken, verifySessionToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import {
  isMockTelegramEnabled,
  mockTelegramUser,
  validateInitData,
  type TelegramUser,
} from "@/lib/telegram/validate";

export function isAdmin(userId: string) {
  const ids = (process.env.NEXT_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

/** Creates/updates Postgres user on game actions only — visitors live in bot SQLite. */
export async function upsertTelegramUser(user: TelegramUser) {
  await prisma.telegramUser.upsert({
    where: { id: user.id },
    update: {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      languageCode: user.languageCode,
    },
    create: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      languageCode: user.languageCode,
    },
  });
}

export function resolveInitUser(initData: string) {
  if (!initData) {
    if (!isMockTelegramEnabled()) {
      return { ok: false as const, status: 401 as const, error: copy.openInTelegram };
    }
    return { ok: true as const, user: mockTelegramUser() };
  }
  const validated = validateInitData(initData);
  if (!validated.ok) {
    return { ok: false as const, status: validated.status, error: validated.error };
  }
  return { ok: true as const, user: validated.user };
}

export async function createSession(initData: string) {
  const resolved = resolveInitUser(initData);
  if (!resolved.ok) {
    return { ok: false as const, response: jsonError(resolved.error, resolved.status) };
  }

  const admin = isAdmin(resolved.user.id);
  const { token, expiresAt } = await signSessionToken({
    sub: resolved.user.id,
    username: resolved.user.username,
    firstName: resolved.user.firstName,
    lastName: resolved.user.lastName,
    isAdmin: admin,
  });

  return {
    ok: true as const,
    session: {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: resolved.user.id,
        username: resolved.user.username,
        firstName: resolved.user.firstName,
        lastName: resolved.user.lastName,
        isAdmin: admin,
      },
    },
  };
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export async function authenticate(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return { ok: false as const, response: jsonError(copy.unauthorized, 401) };
  }

  const claims = await verifySessionToken(token);
  if (!claims) {
    return { ok: false as const, response: jsonError(copy.sessionExpired, 401) };
  }

  return {
    ok: true as const,
    user: {
      id: claims.sub,
      username: claims.username,
      firstName: claims.firstName,
      lastName: claims.lastName,
      isAdmin: claims.isAdmin,
    },
  };
}

export async function authenticateAdmin(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth;
  if (!auth.user.isAdmin && !isAdmin(auth.user.id)) {
    return { ok: false as const, response: jsonError(copy.forbidden, 403) };
  }
  return auth;
}
