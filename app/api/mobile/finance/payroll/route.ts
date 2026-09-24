import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

const tables = {
  fronting: { table: "master_pegawai", identity: "nik" },
  non_fronting: { table: "data_non_fronting", identity: "nik" },
  leader: { table: "data_leader", identity: "username" },
} as const;

interface IdentityRow extends RowDataPacket { identity: string }

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "keuangan") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request" }, { status: 400 }); }
  const amount = body && typeof body === "object" && "amount" in body ? body.amount : undefined;
  if (!body || typeof body !== "object" || !("id" in body) || !("employeeKind" in body) || !("action" in body) ||
      typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0 ||
      typeof body.employeeKind !== "string" || !(body.employeeKind in tables) ||
      (body.action !== "save" && body.action !== "share") ||
      (body.action === "save" && (typeof amount !== "number" ||
        !Number.isFinite(amount) || amount < 0))) {
    return NextResponse.json({ message: "Invalid payroll request" }, { status: 400 });
  }
  const employeeKind = body.employeeKind as keyof typeof tables;
  const source = tables[employeeKind];
  const connection = await pool.getConnection();
  try {
    const [people] = await connection.query<IdentityRow[]>(
      `SELECT ${source.identity} AS identity FROM ${source.table} WHERE id = ? LIMIT 1`, [body.id],
    );
    if (!people[0]) return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    const period = new Date().toISOString().slice(0, 7);
    await connection.beginTransaction();
    if (body.action === "save") {
      await connection.query(
        `INSERT INTO transaksi_gaji
         (employee_kind, id_pegawai, periode, estimasi, estimasi_shared, slip_sent)
         VALUES (?, ?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE estimasi = VALUES(estimasi)`,
        [employeeKind, body.id, period, amount],
      );
    } else {
      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE transaksi_gaji SET estimasi_shared = 1
         WHERE employee_kind = ? AND id_pegawai = ? AND periode = ?`,
        [employeeKind, body.id, period],
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return NextResponse.json({ message: "Simpan estimasi terlebih dahulu" }, { status: 404 });
      }
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, is_read)
         VALUES ('Admin Keuangan', ?, 'Pengumuman Pribadi', ?, 0)`,
        [people[0].identity, `Estimasi pendapatan periode ${period} telah dibagikan oleh Keuangan.`],
      );
    }
    await connection.commit();
    return NextResponse.json({ success: true, message: body.action === "save" ? "Estimasi tersimpan" : "Estimasi dibagikan" });
  } catch {
    await connection.rollback();
    return NextResponse.json({ message: "Unable to update payroll" }, { status: 500 });
  } finally {
    connection.release();
  }
}
