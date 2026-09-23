import { randomUUID } from "node:crypto";

import type { AuthenticatedUser, Credentials } from "@/lib/credentials";
import { authenticateUser } from "@/lib/credentials";
import { pool } from "@/lib/db";

import {
  createAccessToken,
  createRefreshToken,
  getBearerPrincipal,
  getRefreshTokenExpiry,
  hashRefreshToken,
  toAuthenticatedUser,
  toMobileUser,
} from "./helpers";
import type { MobileSession, MobileUserRow, RefreshTokenRow } from "./types";

async function createMobileSession(user: AuthenticatedUser): Promise<MobileSession> {
  const refreshToken = createRefreshToken();
  const refreshTokenExpiresAt = getRefreshTokenExpiry();
  const accessToken = await createAccessToken(user);

  await pool.query(
    `INSERT INTO mobile_auth_refresh_tokens (id, token_hash, user_id, expires_at)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), hashRefreshToken(refreshToken), user.id, refreshTokenExpiresAt],
  );

  return {
    accessToken: accessToken.token,
    accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
    refreshToken,
    user: toMobileUser(user),
  };
}

export async function signInMobileUser(
  credentials: Credentials,
): Promise<MobileSession | null> {
  const user = await authenticateUser(credentials);
  return user ? createMobileSession(user) : null;
}

export async function getMobilePrincipal(request: Request) {
  return getBearerPrincipal(request);
}

export async function rotateMobileRefreshToken(
  refreshToken: string,
): Promise<MobileSession | null> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [tokenRows] = await connection.query<RefreshTokenRow[]>(
      `SELECT id, user_id, expires_at, revoked_at
       FROM mobile_auth_refresh_tokens
       WHERE token_hash = ?
       FOR UPDATE`,
      [hashRefreshToken(refreshToken)],
    );
    const storedToken = tokenRows[0];

    if (
      !storedToken ||
      storedToken.revoked_at ||
      storedToken.expires_at <= new Date()
    ) {
      await connection.rollback();
      return null;
    }

    const [userRows] = await connection.query<MobileUserRow[]>(
      "SELECT id, username, role, jabatan FROM users WHERE id = ? LIMIT 1",
      [storedToken.user_id],
    );
    const storedUser = userRows[0];
    const user = storedUser ? toAuthenticatedUser(storedUser) : null;

    if (!user) {
      await connection.rollback();
      return null;
    }

    await connection.query(
      "UPDATE mobile_auth_refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE id = ?",
      [storedToken.id],
    );

    const nextRefreshToken = createRefreshToken();
    const nextRefreshTokenExpiry = getRefreshTokenExpiry();
    const accessToken = await createAccessToken(user);

    await connection.query(
      `INSERT INTO mobile_auth_refresh_tokens (id, token_hash, user_id, expires_at)
       VALUES (?, ?, ?, ?)`,
      [
        randomUUID(),
        hashRefreshToken(nextRefreshToken),
        user.id,
        nextRefreshTokenExpiry,
      ],
    );
    await connection.commit();

    return {
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      refreshToken: nextRefreshToken,
      user: toMobileUser(user),
    };
  } catch {
    await connection.rollback();
    throw new Error("Unable to refresh the mobile session");
  } finally {
    connection.release();
  }
}

export async function revokeMobileRefreshToken(refreshToken: string): Promise<void> {
  await pool.query(
    `UPDATE mobile_auth_refresh_tokens
     SET revoked_at = UTC_TIMESTAMP()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [hashRefreshToken(refreshToken)],
  );
}
