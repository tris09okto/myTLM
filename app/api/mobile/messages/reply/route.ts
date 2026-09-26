import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface OriginalRow extends RowDataPacket {
  pengirim_role: string;
  penerima_nik: string;
  tipe_pesan: string;
}

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "admin" && principal.role !== "keuangan")) {
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
  try {
    const recipients = [
      principal.username,
      principal.role,
      principal.jabatan,
      principal.jabatan.toUpperCase(),
      "ALL",
      "SEMUA",
    ];
    const [originals] = await pool.query<OriginalRow[]>(
      `SELECT pengirim_role, penerima_nik, tipe_pesan FROM pesan_notifikasi
       WHERE id = ? AND penerima_nik IN (?, ?, ?, ?, ?, ?) LIMIT 1`,
      [id, ...recipients],
    );
    const original = originals[0];
    if (!original) return NextResponse.json({ message: "Message not found" }, { status: 404 });
    const target = original.pengirim_role === "Admin Keuangan" ? "KEUANGAN" : original.pengirim_role;
    if (!target || target === "ALL" || target === "SEMUA") {
      return NextResponse.json({ message: "Unable to identify sender" }, { status: 400 });
    }
    let fileName: string | null = null;
    if (file instanceof File && file.size > 0) {
      const extension = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 12) || ".bin";
      fileName = `${randomUUID()}${extension}`;
      const folder = path.join(process.cwd(), "public", "uploads", "admin");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, fileName), Buffer.from(await file.arrayBuffer()));
    }
    const sender = principal.jabatan || principal.role;
    const type = sender.toLowerCase() === "direktur" ? `Balasan Direktur #${id}` : `Balasan ${original.tipe_pesan}`;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [sender, target, type, answer.trim(), fileName],
      );
      await connection.query("UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ?", [id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ success: true, message: "Balasan dikirim" });
  } catch {
    return NextResponse.json({ message: "Unable to send reply" }, { status: 500 });
  }
}
