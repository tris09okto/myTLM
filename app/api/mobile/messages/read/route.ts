import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "admin" && principal.role !== "keuangan")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("id" in body) ||
      typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0) {
    return NextResponse.json({ message: "Invalid message" }, { status: 400 });
  }
  try {
    await pool.query(
      `UPDATE pesan_notifikasi SET is_read = 1
       WHERE id = ? AND penerima_nik IN (?, ?, ?, ?, 'ALL', 'SEMUA')`,
      [body.id, principal.username, principal.role, principal.jabatan, principal.jabatan.toUpperCase()],
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Unable to mark message read" }, { status: 500 });
  }
}
