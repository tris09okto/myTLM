import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

const identityTables = {
  fronting: "master_pegawai",
  non_fronting: "data_non_fronting",
  leader: "data_leader",
} as const;

interface IdentityRow extends RowDataPacket { identity: string }

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "keuangan") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const kind = form.get("employeeKind");
  const id = Number(form.get("id"));
  const file = form.get("file");
  if (typeof kind !== "string" || !(kind in identityTables) ||
      !Number.isSafeInteger(id) || id <= 0 || !(file instanceof File) ||
      file.type !== "application/pdf" || file.size === 0 || file.size > 10_000_000) {
    return NextResponse.json({ message: "Invalid payslip" }, { status: 400 });
  }
  const employeeKind = kind as keyof typeof identityTables;
  const table = identityTables[employeeKind];
  const column = employeeKind === "leader" ? "username" : "nik";
  try {
    const [people] = await pool.query<IdentityRow[]>(
      `SELECT ${column} AS identity FROM ${table} WHERE id = ? LIMIT 1`, [id],
    );
    if (!people[0]) return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    const period = new Date().toISOString().slice(0, 7);
    const fileName = `${employeeKind}_${id}_${period}_${randomUUID()}.pdf`;
    const folder = path.join(process.cwd(), "public", "uploads", "slips");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, fileName), Buffer.from(await file.arrayBuffer()));
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO transaksi_gaji
         (employee_kind, id_pegawai, periode, estimasi, estimasi_shared, slip_name, slip_sent)
         VALUES (?, ?, ?, 0, 0, ?, 1)
         ON DUPLICATE KEY UPDATE slip_name = VALUES(slip_name), slip_sent = 1`,
        [employeeKind, id, period, fileName],
      );
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES ('Admin Keuangan', ?, 'Pengumuman Pribadi - Slip Gaji', ?, ?, 0)`,
        [people[0].identity, `Slip gaji periode ${period} telah dibagikan oleh Keuangan.`, fileName],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ success: true, message: "Slip gaji dibagikan", fileName });
  } catch {
    return NextResponse.json({ message: "Unable to upload payslip" }, { status: 500 });
  }
}
