import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password: string;
  role: string;
  jabatan: string;
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
  jabatan: string;
}

export interface Credentials {
  username: string;
  password: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCredentials(value: unknown): Credentials | null {
  if (!isRecord(value)) {
    return null;
  }

  // Gunakan String() untuk menjamin konversi tipe data jika dikirim dari NextAuth
  const rawUsername = typeof value.username === "string" ? value.username : String(value.username || "");
  const rawPassword = typeof value.password === "string" ? value.password : String(value.password || "");

  const username = rawUsername.trim();
  const password = rawPassword;

  if (
    username.length === 0 ||
    password.length === 0 ||
    username.length > 128 ||
    password.length > 1024
  ) {
    return null;
  }

  return { username, password };
}

export async function authenticateUser(
  credentials: Credentials,
): Promise<AuthenticatedUser | null> {
  const [rows] = await pool.query<UserRow[]>(
    "SELECT id, username, password, role, jabatan FROM users WHERE username = ? LIMIT 1",
    [credentials.username],
  );
  const user = rows[0];

  if (
    !user ||
    !Number.isSafeInteger(user.id) ||
    typeof user.username !== "string" ||
    typeof user.role !== "string" ||
    typeof user.jabatan !== "string" ||
    !(await bcrypt.compare(credentials.password, user.password))
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
