import { SignJWT, jwtVerify } from "jose"
import { JWT_TTL_SECONDS } from "@/lib/constants"

export type SessionClaims = {
  sub: string
  username?: string
  firstName?: string
  lastName?: string
  isAdmin: boolean
}

function secretKey() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function signSessionToken(claims: SessionClaims) {
  const expiresAt = new Date(Date.now() + JWT_TTL_SECONDS * 1000)
  const token = await new SignJWT({
    username: claims.username,
    firstName: claims.firstName,
    lastName: claims.lastName,
    isAdmin: claims.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey())
  return { token, expiresAt }
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.sub !== "string" || !payload.sub) return null
    return {
      sub: payload.sub,
      username: typeof payload.username === "string" ? payload.username : undefined,
      firstName: typeof payload.firstName === "string" ? payload.firstName : undefined,
      lastName: typeof payload.lastName === "string" ? payload.lastName : undefined,
      isAdmin: payload.isAdmin === true,
    }
  } catch {
    return null
  }
}
