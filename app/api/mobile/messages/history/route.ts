import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveAttachmentPath } from "@/lib/mobile/attachment-path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "admin" && principal.role !== "keuangan")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const peer = new URL(request.url).searchParams.get("peer")?.trim();
  if (!peer || peer.length > 128 || ["ALL", "SEMUA"].includes(peer.toUpperCase())) {
    return NextResponse.json({ message: "Invalid correspondent" }, { status: 400 });
  }
  try {
    const identities = [principal.username, principal.role, principal.jabatan, principal.jabatan.toUpperCase()];
    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT id, pengirim_role, penerima_nik, tipe_pesan, konten,
              file_lampiran, is_read, created_at FROM pesan_notifikasi
       WHERE (pengirim_role IN (?, ?, ?, ?) AND penerima_nik = ?)
          OR (penerima_nik IN (?, ?, ?, ?) AND pengirim_role = ?)
       ORDER BY created_at ASC`,
      [...identities, peer, ...identities, peer],
    );
    return NextResponse.json({ messages: await Promise.all(messages.map(async (message) => ({
      ...message,
      attachment_path: await resolveAttachmentPath(message.file_lampiran),
    }))) });
  } catch {
    return NextResponse.json({ message: "Unable to load message history" }, { status: 500 });
  }
}
