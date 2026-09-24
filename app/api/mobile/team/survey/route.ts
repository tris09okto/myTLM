import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface SupervisorRow extends RowDataPacket { nama: string }
interface RecipientRow extends RowDataPacket { jabatan: string }

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "supervisor") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const form = await request.formData();
  const description = form.get("keterangan");
  const photo = form.get("foto");
  if (typeof description !== "string" || !description.trim() || description.length > 5000 ||
      (photo !== null && (!(photo instanceof File) || !photo.type.startsWith("image/") || photo.size > 5_000_000))) {
    return NextResponse.json({ message: "Survey tidak valid" }, { status: 400 });
  }

  try {
    const [supervisors] = await pool.query<SupervisorRow[]>(
      "SELECT nama FROM data_non_fronting WHERE username = ? AND jabatan = 'supervisor' LIMIT 1",
      [principal.username],
    );
    const name = supervisors[0]?.nama ?? principal.username;
    let fileName: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      const extension = photo.type === "image/png" ? ".png" : photo.type === "image/webp" ? ".webp" : ".jpg";
      fileName = `${randomUUID()}${extension}`;
      const folder = path.join(process.cwd(), "public", "uploads", "spv-survey-kunjungan");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, fileName), Buffer.from(await photo.arrayBuffer()));
    }
    await pool.query(
      `INSERT INTO survey_kunjungan (spv_username, spv_nama, keterangan, foto, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [principal.username, name, description.trim(), fileName],
    );
    const [recipients] = await pool.query<RecipientRow[]>(
      "SELECT jabatan FROM users WHERE LOWER(jabatan) LIKE '%mo%' OR LOWER(jabatan) LIKE '%hrd%'",
    );
    for (const recipient of recipients) {
      await pool.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, ?, 'Survey Kunjungan Lapangan', ?, ?, 0, NOW())`,
        [principal.username, recipient.jabatan, `[Survey Kunjungan] Dari SPV: ${name} (${principal.username}). Keterangan: "${description.trim()}"`, fileName],
      );
    }
    return NextResponse.json({ success: true, message: "Survey kunjungan berhasil dikirim." });
  } catch {
    return NextResponse.json({ message: "Survey gagal dikirim" }, { status: 500 });
  }
}
