import { cookies } from "next/headers";
import { verifyAccessToken, verifyRefreshToken } from "./jwt";

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? "refreshToken";

export type AuthUser = { id: number };

export function getAuthUserIdFromRequest(request: Request): number | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;

  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  try {
    const claims = verifyAccessToken(token);
    const userId = Number(claims.sub);
    if (!Number.isFinite(userId)) return null;
    return userId;
  } catch {
    return null;
  }
}

export function getRefreshTokenFromCookies(): string | null {
  const cookie = cookies().get(REFRESH_COOKIE_NAME);
  return cookie?.value ?? null;
}

export function getRefreshTokenClaims(refreshToken: string) {
  return verifyRefreshToken(refreshToken);
}

export const refreshCookieName = REFRESH_COOKIE_NAME;

