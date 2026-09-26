import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveUploadUrl } from "@/lib/mobile/attachment-path";
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from "@/lib/uploads";

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
  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    const [people] = await pool.query<IdentityRow[]>(
      `SELECT ${column} AS identity FROM ${table} WHERE id = ? LIMIT 1`, [id],
    );
    if (!people[0]) return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    const period = new Date().toISOString().slice(0, 7);
    const fileName = `${employeeKind}_${id}_${period}_${randomUUID()}.pdf`;
    upload = await storeFileUpload({ file, folder: "slips", localFileName: fileName, resourceType: "raw" });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    await connection.query(
      `INSERT INTO transaksi_gaji
       (employee_kind, id_pegawai, periode, estimasi, estimasi_shared, slip_name, slip_sent)
       VALUES (?, ?, ?, 0, 0, ?, 1)
       ON DUPLICATE KEY UPDATE slip_name = VALUES(slip_name), slip_sent = 1`,
      [employeeKind, id, period, upload.reference],
    );
    await connection.query(
      `INSERT INTO pesan_notifikasi
       (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
       VALUES ('Admin Keuangan', ?, 'Pengumuman Pribadi - Slip Gaji', ?, ?, 0)`,
      [people[0].identity, `Slip gaji periode ${period} telah dibagikan oleh Keuangan.`, upload.reference],
    );
    await connection.commit();
    committed = true;
    return NextResponse.json({
      success: true,
      message: "Slip gaji dibagikan",
      fileName: upload.reference,
      slip_url: await resolveUploadUrl(upload.reference, "slips"),
    });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Unable to roll back payslip transaction", rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error("Unable to upload payslip", error);
    return NextResponse.json({ message: "Unable to upload payslip" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
