import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface PasswordRow extends RowDataPacket { password: string }

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || !["pegawai", "leader", "supervisor"].includes(principal.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("oldPassword" in body) || !("newPassword" in body) ||
      typeof body.oldPassword !== "string" || typeof body.newPassword !== "string" ||
      body.newPassword.length < 6 || body.newPassword.length > 1024) {
    return NextResponse.json({ message: "Password tidak valid" }, { status: 400 });
  }

  try {
    const [users] = await pool.query<PasswordRow[]>(
      "SELECT password FROM users WHERE id = ? AND username = ? LIMIT 1",
      [principal.id, principal.username],
    );
    if (!users[0] || !(await bcrypt.compare(body.oldPassword, users[0].password))) {
      return NextResponse.json({ message: "Password lama salah" }, { status: 400 });
    }
    const password = await bcrypt.hash(body.newPassword, 10);
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [password, principal.id]);
    if (principal.role === "leader") {
      await pool.query("UPDATE data_leader SET password = ? WHERE username = ?", [password, principal.username]);
    } else if (principal.role === "supervisor") {
      await pool.query("UPDATE data_non_fronting SET password = ? WHERE username = ?", [password, principal.username]);
    } else {
      await pool.query("UPDATE master_pegawai SET password = ? WHERE username = ?", [password, principal.username]);
      await pool.query("UPDATE data_non_fronting SET password = ? WHERE username = ?", [password, principal.username]);
    }
    return NextResponse.json({ success: true, message: "Password berhasil diubah." });
  } catch {
    return NextResponse.json({ message: "Password gagal diubah" }, { status: 500 });
  }
}
