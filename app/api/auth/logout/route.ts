import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";
import { refreshCookieName, getRefreshTokenClaims, getRefreshTokenFromCookies } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const refreshToken = getRefreshTokenFromCookies();
  const cookieStore = cookies();

  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(refreshCookieName, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
  });

  if (!refreshToken) {
    return json({ message: "Logged out" });
  }

  try {
    const claims = getRefreshTokenClaims(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { jti: claims.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
  }

  return json({ message: "Logged out" });
}

