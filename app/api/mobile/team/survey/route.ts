import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from "@/lib/uploads";

export const runtime = "nodejs";

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

  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    const [recipients] = await pool.query<RecipientRow[]>(
      "SELECT jabatan FROM users WHERE LOWER(jabatan) LIKE '%mo%' OR LOWER(jabatan) LIKE '%hrd%'",
    );
    let fileName: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      const extension = photo.type === "image/png" ? ".png" : photo.type === "image/webp" ? ".webp" : ".jpg";
      upload = await storeFileUpload({
        file: photo,
        folder: "spv-survey-kunjungan",
        localFileName: `${randomUUID()}${extension}`,
        resourceType: "image",
      });
      fileName = upload.reference;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    await connection.query(
      `INSERT INTO survey_kunjungan (spv_username, spv_nama, keterangan, foto, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [principal.username, principal.username, description.trim(), fileName],
    );
    for (const recipient of recipients) {
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, ?, 'Survey Kunjungan Lapangan', ?, ?, 0, NOW())`,
        [principal.username, recipient.jabatan, `[Survey Kunjungan] Dari SPV: ${principal.username} (${principal.username}). Keterangan: "${description.trim()}"`, fileName],
      );
    }
    await connection.commit();
    committed = true;
    return NextResponse.json({ success: true, message: "Survey kunjungan berhasil dikirim." });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Unable to roll back survey transaction", rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error("Unable to submit mobile survey", error);
    return NextResponse.json({ message: "Survey gagal dikirim" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
