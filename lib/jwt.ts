import jwt, { JwtPayload, type SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) {
    throw new Error(`Invalid TTL format "${ttl}". Use formats like "15m", "30d", "90s", "12h".`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

export type AccessTokenClaims = {
  sub: string;
  type: "access";
};

export type RefreshTokenClaims = {
  sub: string;
  type: "refresh";
  jti: string;
};

function getAccessSecret(): string {
  return getRequiredEnv("JWT_ACCESS_SECRET");
}

function getRefreshSecret(): string {
  return getRequiredEnv("JWT_REFRESH_SECRET");
}

function getAccessExpiresInStr(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
}

function getRefreshExpiresInStr(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";
}

function getAccessExpiresIn(): SignOptions["expiresIn"] {
  return getAccessExpiresInStr() as unknown as SignOptions["expiresIn"];
}

function getRefreshExpiresIn(): SignOptions["expiresIn"] {
  return getRefreshExpiresInStr() as unknown as SignOptions["expiresIn"];
}

export const accessExpiresAtFromNow = (): Date =>
  new Date(Date.now() + parseTtlToMs(getAccessExpiresInStr()));

export const refreshExpiresAtFromNow = (): Date =>
  new Date(Date.now() + parseTtlToMs(getRefreshExpiresInStr()));

export function signAccessToken(userId: number): string {
  return jwt.sign(
    { sub: userId.toString(), type: "access" },
    getAccessSecret(),
    {
      expiresIn: getAccessExpiresIn(),
    }
  );
}

export function signRefreshToken(userId: number): { token: string; jti: string } {
  const jti = randomUUID();

  const token = jwt.sign(
    { sub: userId.toString(), type: "refresh", jti },
    getRefreshSecret(),
    {
      expiresIn: getRefreshExpiresIn(),
    }
  );

  return { token, jti };
}

function parseJwtPayload(payload: string | JwtPayload): JwtPayload {
  if (typeof payload === "string") {
    throw new Error("Unexpected JWT payload format");
  }
  return payload;
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, getAccessSecret()) as string | JwtPayload;
  const payload = parseJwtPayload(decoded);

  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }

  return payload as unknown as AccessTokenClaims;
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const decoded = jwt.verify(token, getRefreshSecret()) as string | JwtPayload;
  const payload = parseJwtPayload(decoded);

  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }

  const jti = (payload as RefreshTokenClaims).jti;
  if (!jti) {
    throw new Error("Refresh token missing jti");
  }

  return payload as unknown as RefreshTokenClaims;
}

