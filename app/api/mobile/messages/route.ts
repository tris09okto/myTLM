import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveAttachmentPath, resolveUploadUrl } from "@/lib/mobile/attachment-path";
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from "@/lib/uploads";

export const runtime = "nodejs";

const allowedFlags = new Set(["ALL", "ALL_FRONTING", "ALL_NON_FRONTING", "HRD", "MO", "DIREKTUR", "KEUANGAN"]);

function adminRecipientForCategory(jabatan: string, type: string): string | null | undefined {
  const normalized = jabatan.toLowerCase();
  const categories = new Map<string, string | null>();

  if (normalized === "direktur") {
    categories.set("Instruksi Umum", "ALL");
    categories.set("Instruksi ke MO", "MO");
    categories.set("Instruksi ke HRD", "HRD");
    categories.set("Instruksi ke Keuangan", "KEUANGAN");
    return categories.get(type);
  }

  categories.set("Pesan Umum", "ALL");
  if (normalized === "hrd") {
    categories.set("Broadcast Fronting", "ALL_FRONTING");
    categories.set("Broadcast Non Fronting", "ALL_NON_FRONTING");
    categories.set("Surat Peringatan", null);
  }
  if (normalized === "mo") categories.set("Surat Perintah Tugas", null);
  if (["mo", "hrd", "keuangan"].includes(normalized)) {
    categories.set("Laporan ke Direktur", "DIREKTUR");
  }
  return categories.get(type);
}

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
      attachment_url: await resolveUploadUrl(message.file_lampiran, "admin"),
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
  if (principal.role === "admin") {
    const expectedRecipient = adminRecipientForCategory(principal.jabatan, type.trim());
    if (expectedRecipient === undefined) {
      return NextResponse.json({ message: "Kategori pesan tidak diizinkan" }, { status: 403 });
    }
    if (
      (expectedRecipient !== null && destination.toUpperCase() !== expectedRecipient) ||
      (expectedRecipient === null && allowedFlags.has(destination.toUpperCase()))
    ) {
      return NextResponse.json({ message: "Tujuan tidak sesuai dengan kategori pesan" }, { status: 400 });
    }
  }
  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
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
      upload = await storeFileUpload({
        file: attachment,
        folder: "admin",
        localFileName: `${randomUUID()}${extension}`,
      });
      fileName = upload.reference;
    }
    const sender = principal.jabatan || principal.role;
    const destinations = sender.toLowerCase() === "direktur" && destination === "ALL"
      ? ["MO", "HRD", "Keuangan"] : [destination];
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    for (const target of destinations) {
      await connection.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [sender, target, type.trim(), content.trim(), fileName],
      );
    }
    await connection.commit();
    committed = true;
    return NextResponse.json({ success: true, message: "Pesan berhasil dikirim." });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Unable to roll back message transaction", rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error("Unable to send message", error);
    return NextResponse.json({ message: "Pesan gagal dikirim" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
