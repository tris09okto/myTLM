import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { taskOrderReplyTarget } from "@/lib/mobile/task-order";
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from "@/lib/uploads";

export const runtime = "nodejs";

interface OriginalRow extends RowDataPacket {
  pengirim_role: string;
  penerima_nik: string;
  tipe_pesan: string;
}

interface EmployeeRow extends RowDataPacket {
  nik: string;
  nama: string;
}

class ReplyRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || !["admin", "keuangan", "pegawai"].includes(principal.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const id = Number(form.get("id"));
  const answer = form.get("answer");
  const file = form.get("attachment");
  if (!Number.isSafeInteger(id) || id <= 0 || typeof answer !== "string" || !answer.trim() || answer.length > 10000 ||
      (file !== null && (!(file instanceof File) || file.size > 10_000_000))) {
    return NextResponse.json({ message: "Invalid reply" }, { status: 400 });
  }

  let connection: PoolConnection | undefined;
  let upload: StoredUpload | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    let employee: EmployeeRow | undefined;
    if (principal.role === "pegawai") {
      const [employees] = await pool.query<EmployeeRow[]>(
        `SELECT nik, nama FROM master_pegawai WHERE username = ?
         UNION SELECT nik, nama FROM data_non_fronting WHERE username = ? LIMIT 1`,
        [principal.username, principal.username],
      );
      employee = employees[0];
      if (!employee) throw new ReplyRequestError("Employee profile not found", 404);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    let original: OriginalRow | undefined;
    if (employee) {
      const [originals] = await connection.query<OriginalRow[]>(
        `SELECT pengirim_role, penerima_nik, tipe_pesan FROM pesan_notifikasi
         WHERE id = ? AND penerima_nik = ? AND tipe_pesan = 'Surat Perintah Tugas'
         LIMIT 1 FOR UPDATE`,
        [id, employee.nik],
      );
      original = originals[0];
      if (!original) throw new ReplyRequestError("Task-order message not found", 404);
      if (!taskOrderReplyTarget(original.pengirim_role)) {
        throw new ReplyRequestError("Unable to identify task-order sender", 400);
      }
    } else {
      const recipients = [
        principal.username,
        principal.role,
        principal.jabatan,
        principal.jabatan.toUpperCase(),
        "ALL",
        "SEMUA",
      ];
      const [originals] = await connection.query<OriginalRow[]>(
        `SELECT pengirim_role, penerima_nik, tipe_pesan FROM pesan_notifikasi
         WHERE id = ? AND penerima_nik IN (?, ?, ?, ?, ?, ?) LIMIT 1 FOR UPDATE`,
        [id, ...recipients],
      );
      original = originals[0];
      if (!original) throw new ReplyRequestError("Message not found", 404);
    }

    let target: string;
    let sender: string;
    let type: string;
    let replyContent = answer.trim();
    const uploadFolder = employee ? "balasan_pegawai" : "admin";
    if (employee) {
      const division = taskOrderReplyTarget(original.pengirim_role);
      if (!division) throw new ReplyRequestError("Unable to identify task-order sender", 400);
      target = division;
      sender = employee.nik;
      type = "Balasan Surat Perintah Tugas";
      replyContent = `[${employee.nama} (${employee.nik})]\n${replyContent}`;
    } else {
      target = original.pengirim_role === "Admin Keuangan" ? "KEUANGAN" : original.pengirim_role;
      if (!target || target === "ALL" || target === "SEMUA") {
        throw new ReplyRequestError("Unable to identify sender", 400);
      }
      sender = principal.jabatan || principal.role;
      type = sender.toLowerCase() === "direktur" ? `Balasan Direktur #${id}` : `Balasan ${original.tipe_pesan}`;
    }

    let fileReference: string | null = null;
    if (file instanceof File && file.size > 0) {
      const extension = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 12) || ".bin";
      upload = await storeFileUpload({
        file,
        folder: uploadFolder,
        localFileName: employee ? `balasan_pegawai_${id}_${randomUUID()}${extension}` : `${randomUUID()}${extension}`,
      });
      fileReference = upload.reference;
    }

    await connection.query(
      `INSERT INTO pesan_notifikasi
       (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [sender, target, type, replyContent, fileReference],
    );
    await connection.query("UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ?", [id]);
    await connection.commit();
    committed = true;

    return NextResponse.json({
      success: true,
      message: employee ? `Balasan dari ${employee.nama} terkirim` : "Balasan dikirim",
    });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Unable to roll back reply transaction", rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    if (error instanceof ReplyRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Unable to send reply" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
