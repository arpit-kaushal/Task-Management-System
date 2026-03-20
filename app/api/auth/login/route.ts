import bcrypt from "bcrypt";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { json, httpError } from "@/lib/http";
import { refreshCookieName } from "@/lib/auth";
import { signAccessToken, signRefreshToken, refreshExpiresAtFromNow } from "@/lib/jwt";

export const runtime = "nodejs";

const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, "Invalid JSON body");
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return httpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user) {
    return httpError(401, "Invalid email or password");
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return httpError(401, "Invalid email or password");
  }

  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const { token: refreshToken, jti } = signRefreshToken(user.id);
  const expiresAt = refreshExpiresAtFromNow();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      expiresAt,
      revokedAt: null,
    },
  });

  const accessToken = signAccessToken(user.id);

  const cookieStore = cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(refreshCookieName, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    expires: expiresAt,
  });

  return json({ user: { id: user.id, email: user.email }, accessToken });
}

