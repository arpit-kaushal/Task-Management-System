import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { json, httpError } from "@/lib/http";
import { refreshCookieName, getRefreshTokenClaims, getRefreshTokenFromCookies } from "@/lib/auth";
import { signAccessToken, signRefreshToken, refreshExpiresAtFromNow } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const refreshToken = getRefreshTokenFromCookies();
  if (!refreshToken) {
    return httpError(401, "Unauthorized");
  }

  let claims;
  try {
    claims = getRefreshTokenClaims(refreshToken);
  } catch {
    return httpError(401, "Unauthorized");
  }

  const userId = Number(claims.sub);
  if (!Number.isFinite(userId)) return httpError(401, "Unauthorized");

  const stored = await prisma.refreshToken.findUnique({
    where: { jti: claims.jti },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });

  if (!stored || stored.userId !== userId) return httpError(401, "Unauthorized");
  if (stored.revokedAt) return httpError(401, "Unauthorized");
  if (stored.expiresAt.getTime() <= Date.now()) return httpError(401, "Unauthorized");

  await prisma.refreshToken.update({
    where: { jti: claims.jti },
    data: { revokedAt: new Date() },
  });

  const { token: nextRefreshToken, jti: nextJti } = signRefreshToken(userId);
  const expiresAt = refreshExpiresAtFromNow();

  await prisma.refreshToken.create({
    data: {
      userId,
      jti: nextJti,
      expiresAt,
      revokedAt: null,
    },
  });

  const accessToken = signAccessToken(userId);

  const cookieStore = cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(refreshCookieName, nextRefreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    expires: expiresAt,
  });

  return json({ accessToken });
}

