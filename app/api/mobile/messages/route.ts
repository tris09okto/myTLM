import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveAttachmentPath } from "@/lib/mobile/attachment-path";

export const runtime = "nodejs";

const allowedFlags = new Set(["ALL", "ALL_FRONTING", "ALL_NON_FRONTING", "HRD", "MO", "DIREKTUR", "KEUANGAN"]);

function inboxRecipients(principal: { username: string; role: string; jabatan: string }) {
  return [principal.username, principal.role, principal.jabatan, principal.jabatan.toUpperCase(), "ALL", "SEMUA"];
}

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "admin" && principal.role !== "keuangan")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const recipients = inboxRecipients(principal);
    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT id, pengirim_role, penerima_nik, tipe_pesan, konten,
              file_lampiran, is_read, created_at
       FROM pesan_notifikasi WHERE penerima_nik IN (?, ?, ?, ?, ?, ?)
       ORDER BY created_at DESC`,
      recipients,
    );
    return NextResponse.json({ messages: await Promise.all(messages.map(async (message) => ({
      ...message,
      attachment_path: await resolveAttachmentPath(message.file_lampiran),
    }))) });
  } catch {
    return NextResponse.json({ message: "Unable to load messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "admin" && principal.role !== "keuangan")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const form = await request.formData();
  const recipient = form.get("recipient");
  const type = form.get("type");
  const content = form.get("content");
  const attachment = form.get("attachment");
  if (typeof recipient !== "string" || !recipient.trim() || recipient.length > 128 ||
      typeof type !== "string" || !type.trim() || type.length > 128 ||
      typeof content !== "string" || !content.trim() || content.length > 10000 ||
      (attachment !== null && (!(attachment instanceof File) || attachment.size > 10_000_000))) {
    return NextResponse.json({ message: "Pesan tidak valid" }, { status: 400 });
  }
  const rawDestination = recipient.trim();
  const destination = allowedFlags.has(rawDestination.toUpperCase())
    ? rawDestination.toUpperCase()
    : rawDestination;
  try {
    if (!allowedFlags.has(destination.toUpperCase())) {
      const [matches] = await pool.query<RowDataPacket[]>(
        `SELECT nik FROM master_pegawai WHERE nik = ?
         UNION SELECT nik FROM data_non_fronting WHERE nik = ? LIMIT 1`,
        [destination, destination],
      );
      if (!matches.length) return NextResponse.json({ message: "Penerima tidak ditemukan" }, { status: 404 });
    }
    let fileName: string | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      const extension = path.extname(attachment.name).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 12) || ".bin";
      fileName = `${randomUUID()}${extension}`;
      const folder = path.join(process.cwd(), "public", "uploads", "admin");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, fileName), Buffer.from(await attachment.arrayBuffer()));
    }
    const sender = principal.jabatan || principal.role;
    const destinations = sender.toLowerCase() === "direktur" && destination === "ALL"
      ? ["MO", "HRD", "Keuangan"] : [destination];
    for (const target of destinations) {
      await pool.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [sender, target, type.trim(), content.trim(), fileName],
      );
    }
    return NextResponse.json({ success: true, message: "Pesan berhasil dikirim." });
  } catch {
    return NextResponse.json({ message: "Pesan gagal dikirim" }, { status: 500 });
  }
}
