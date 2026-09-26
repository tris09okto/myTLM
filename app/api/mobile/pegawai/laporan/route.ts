import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from "@/lib/uploads";

export const runtime = "nodejs";

interface EmployeeRow extends RowDataPacket {
  nik: string;
  nama: string;
  leader?: string;
  supervisor?: string | null;
}

interface UsernameRow extends RowDataPacket {
  username: string;
}

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "pegawai") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const pesan = form.get("pesan");
  const target = form.get("target");
  const photo = form.get("foto");
  if (typeof pesan !== "string" || !pesan.trim() || pesan.length > 5000 ||
      (target !== "leader" && target !== "super_admin") ||
      (photo !== null && (!(photo instanceof File) || !photo.type.startsWith("image/") || photo.size > 5_000_000))) {
    return NextResponse.json({ message: "Laporan tidak valid" }, { status: 400 });
  }

  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    const [fronting] = await pool.query<EmployeeRow[]>(
      "SELECT nik, nama, leader FROM master_pegawai WHERE username = ? LIMIT 1",
      [principal.username],
    );
    let nonFronting: EmployeeRow[] = [];
    if (!fronting.length) {
      [nonFronting] = await pool.query<EmployeeRow[]>(
        "SELECT nik, nama, supervisor FROM data_non_fronting WHERE username = ? LIMIT 1",
        [principal.username],
      );
    }
    const employee = fronting[0] ?? nonFronting[0];
    if (!employee) {
      return NextResponse.json({ message: "Profil pegawai tidak ditemukan" }, { status: 404 });
    }

    const toLeader = target === "leader";
    let title = "";
    let description = "";
    let supervisorUsername: string | undefined;
    if (fronting.length) {
      title = `[Aduan ${toLeader ? `Leader ${employee.leader}` : "Super Admin"}] dari ${employee.nama} (${employee.nik})`;
      description = `Pertanyaan :\n${pesan.trim()}\n\nJawaban :\n[Menunggu balasan dari ${toLeader ? "Leader" : "Super Admin"}]`;
    } else {
      if (employee.supervisor) {
        const [supervisors] = await pool.query<UsernameRow[]>(
          "SELECT username FROM data_non_fronting WHERE nama = ? OR username = ? LIMIT 1",
          [employee.supervisor, employee.supervisor],
        );
        supervisorUsername = supervisors[0]?.username;
      }
    }

    let fileName: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      const extension = photo.type === "image/png" ? ".png" : photo.type === "image/webp" ? ".webp" : ".jpg";
      upload = await storeFileUpload({
        file: photo,
        folder: fronting.length ? "qna" : "non-fronting",
        localFileName: `${randomUUID()}${extension}`,
        resourceType: "image",
      });
      fileName = upload.reference;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    if (fronting.length) {
      await connection.query(
        "INSERT INTO qna_materi (judul, kategori, deskripsi, file_name) VALUES (?, ?, ?, ?)",
        [title, toLeader ? "Aduan Leader" : "Aduan Super Admin", description, fileName ?? ""],
      );
    } else {
      await connection.query(
        "INSERT INTO laporan_aduan (nik, nama, target, pesan, foto, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [employee.nik, employee.nama, "admin_mo_spv", pesan.trim(), fileName],
      );
      if (supervisorUsername) {
        await connection.query(
          `INSERT INTO pesan_notifikasi
           (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
           VALUES (?, ?, 'Laporan Pegawai', ?, ?, 0, NOW())`,
          [employee.nik, supervisorUsername, `[Laporan Pegawai] Dari: ${employee.nama} (${employee.nik}). Pesan: "${pesan.trim()}"`, fileName],
        );
      }
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, 'MO', 'Laporan Pegawai', ?, ?, 0, NOW())`,
        [employee.nik, `[Laporan Baru] Dari Pegawai: ${employee.nama} (${employee.nik}). Pesan: "${pesan.trim()}"`, fileName],
      );
    }
    await connection.commit();
    committed = true;

    return NextResponse.json({ success: true, message: "Laporan berhasil dikirim." });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Unable to roll back report transaction", rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error("Unable to submit mobile report", error);
    return NextResponse.json({ message: "Laporan gagal dikirim" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
