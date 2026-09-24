import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface EmployeeRow extends RowDataPacket { nik: string; kind: string }

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "pegawai") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("id" in body) ||
      typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0) {
    return NextResponse.json({ message: "Invalid message" }, { status: 400 });
  }
  try {
    const [employees] = await pool.query<EmployeeRow[]>(
      `SELECT nik, 'fronting' AS kind FROM master_pegawai WHERE username = ?
       UNION ALL SELECT nik, 'non-fronting' AS kind FROM data_non_fronting WHERE username = ? LIMIT 1`,
      [principal.username, principal.username],
    );
    const employee = employees[0];
    if (!employee) return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    const group = employee.kind === "fronting" ? "ALL_FRONTING" : "ALL_NON_FRONTING";
    await pool.query(
      `UPDATE pesan_notifikasi SET is_read = 1
       WHERE id = ? AND penerima_nik IN (?, 'ALL', 'SEMUA', ?)`,
      [body.id, employee.nik, group],
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Unable to mark message read" }, { status: 500 });
  }
}
