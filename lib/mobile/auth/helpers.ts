import { createHash, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import type { AuthenticatedUser } from "@/lib/credentials";

import type { MobileUser, MobileUserRow } from "./types";

const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REFRESH_TOKEN_LIFETIME_DAYS = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMobileAuthSecret(): Uint8Array {
  const secret = process.env.MOBILE_AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("MOBILE_AUTH_SECRET must contain at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

export function parseRefreshToken(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const refreshToken = value.refreshToken;
  return typeof refreshToken === "string" &&
    refreshToken.length > 0 &&
    refreshToken.length <= 256
    ? refreshToken
    : null;
}

export function toMobileUser(user: AuthenticatedUser): MobileUser {
  return {
    id: String(user.id),
    username: user.username,
    role: user.role,
    jabatan: user.jabatan,
  };
}

export function toAuthenticatedUser(
  user: MobileUserRow,
): AuthenticatedUser | null {
  if (
    !Number.isSafeInteger(user.id) ||
    typeof user.username !== "string" ||
    typeof user.role !== "string" ||
    typeof user.jabatan !== "string"
  ) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    jabatan: user.jabatan,
  };
}

export function getRefreshTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + REFRESH_TOKEN_LIFETIME_DAYS);
  return expiry;
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccessToken(
  user: AuthenticatedUser,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_LIFETIME_SECONDS * 1000);
  const token = await new SignJWT({
    username: user.username,
    role: user.role,
    jabatan: user.jabatan,
    tokenUse: "mobile-access",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getMobileAuthSecret());

  return { token, expiresAt };
}

export async function getBearerPrincipal(
  request: Request,
): Promise<MobileUser | null> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const { payload } = await jwtVerify(token, getMobileAuthSecret(), {
      algorithms: ["HS256"],
    });

    if (
      payload.tokenUse !== "mobile-access" ||
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub) ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.jabatan !== "string"
    ) {
      return null;
    }

    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      jabatan: payload.jabatan,
    };
  } catch {
    return null;
  }
}
