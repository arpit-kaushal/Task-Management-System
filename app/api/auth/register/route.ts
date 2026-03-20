import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { json, httpError } from "@/lib/http";
import { signAccessToken, signRefreshToken, refreshExpiresAtFromNow } from "@/lib/jwt";
import { cookies } from "next/headers";
import { refreshCookieName } from "@/lib/auth";

export const runtime = "nodejs";

const RegisterSchema = z.object({
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

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return httpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return httpError(400, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
    select: { id: true, email: true },
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

  return json({ user, accessToken });
}

