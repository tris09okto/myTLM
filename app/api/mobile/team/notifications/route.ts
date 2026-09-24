import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveAttachmentPath } from "@/lib/mobile/attachment-path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "supervisor") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const [notifications] = await pool.query<RowDataPacket[]>(
      `SELECT id, pengirim_role, tipe_pesan, konten, file_lampiran, is_read, created_at
       FROM pesan_notifikasi WHERE penerima_nik = ? ORDER BY created_at DESC LIMIT 30`,
      [principal.username],
    );
    return NextResponse.json({ notifications: await Promise.all(notifications.map(async (item) => ({
      ...item, attachment_path: await resolveAttachmentPath(item.file_lampiran),
    }))) });
  } catch {
    return NextResponse.json({ message: "Unable to load notifications" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "supervisor") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("id" in body) ||
      (body.id !== null && (typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0))) {
    return NextResponse.json({ message: "Invalid notification" }, { status: 400 });
  }
  try {
    if (body.id === null) {
      await pool.query(
        "UPDATE pesan_notifikasi SET is_read = 1 WHERE penerima_nik = ? AND is_read = 0",
        [principal.username],
      );
    } else {
      await pool.query(
        "UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ? AND penerima_nik = ?",
        [body.id, principal.username],
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Unable to mark notification read" }, { status: 500 });
  }
}
