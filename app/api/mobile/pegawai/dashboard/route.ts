import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveAttachmentPath } from "@/lib/mobile/attachment-path";

export const runtime = "nodejs";

interface ProfileRow extends RowDataPacket {
  nik: string;
  nama: string;
  jabatan?: string;
  kanwil?: string;
  area?: string;
  penempatan?: string;
  unit_kerja?: string;
  area_penempatan?: string;
  leader?: string;
  supervisor?: string;
  idcard_file?: string;
  st_file?: string | null;
  pas_foto?: string;
  surat_tugas?: string;
}

interface IncomeRow extends RowDataPacket {
  estimasi: string | number;
  estimasi_shared: number;
  slip_name: string | null;
  slip_sent: number;
}

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "pegawai") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [fronting] = await pool.query<ProfileRow[]>(
      `SELECT nik, nama, kanwil, area, penempatan, leader, idcard_file, st_file
       FROM master_pegawai WHERE username = ? LIMIT 1`,
      [principal.username],
    );
    let nonFronting: ProfileRow[] = [];
    if (!fronting.length) {
      [nonFronting] = await pool.query<ProfileRow[]>(
        `SELECT nik, nama, jabatan, unit_kerja, area_penempatan, supervisor, pas_foto, surat_tugas
         FROM data_non_fronting WHERE username = ? LIMIT 1`,
        [principal.username],
      );
    }
    const profile = fronting[0]
      ? { kind: "fronting" as const, ...fronting[0] }
      : nonFronting[0]
        ? { kind: "non-fronting" as const, ...nonFronting[0] }
        : null;
    if (!profile) {
      return NextResponse.json({ message: "Employee profile not found" }, { status: 404 });
    }

    const [announcements] = await pool.query<RowDataPacket[]>(
      `SELECT id, judul, isi, jenis_pengumuman, file_lampiran, created_at
       FROM pengumuman
       WHERE status = 'AKTIF'
         AND target_penerima IN ('ALL', ?, ?)
       ORDER BY created_at DESC`,
      [profile.kind === "fronting" ? "ALL_FRONTING" : "ALL_NON_FRONTING", profile.nik],
    );
    const [materials] = await pool.query<RowDataPacket[]>(
      `SELECT id, judul, kategori, deskripsi, file_name, created_at
       FROM qna_materi
       ORDER BY created_at DESC`,
    );
    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT id, pengirim_role, tipe_pesan, konten, file_lampiran, is_read, created_at
       FROM pesan_notifikasi
       WHERE penerima_nik IN (?, 'ALL', 'SEMUA', ?)
       ORDER BY created_at DESC`,
      [profile.nik, profile.kind === "fronting" ? "ALL_FRONTING" : "ALL_NON_FRONTING"],
    );
    const [reports] = profile.kind === "fronting"
      ? await pool.query<RowDataPacket[]>(
          `SELECT id, judul AS title, deskripsi AS description, file_name AS attachment, created_at
           FROM qna_materi
           WHERE kategori IN ('Aduan Leader', 'Aduan Super Admin') AND judul LIKE ?
           ORDER BY created_at DESC`,
          [`%(${profile.nik})`],
        )
      : await pool.query<RowDataPacket[]>(
          `SELECT id, 'Laporan kegiatan' AS title, pesan AS description,
                  foto AS attachment, created_at
           FROM laporan_aduan WHERE nik = ? ORDER BY created_at DESC`,
          [profile.nik],
        );
    const salaryTable = profile.kind === "fronting" ? "master_pegawai" : "data_non_fronting";
    const salaryKind = profile.kind === "fronting" ? "fronting" : "non_fronting";
    const [income] = await pool.query<IncomeRow[]>(
      `SELECT tg.estimasi, tg.estimasi_shared, tg.slip_name, tg.slip_sent
       FROM transaksi_gaji tg JOIN ${salaryTable} employee ON tg.id_pegawai = employee.id
       WHERE tg.employee_kind = ? AND employee.username = ?
         AND tg.periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m') LIMIT 1`,
      [salaryKind, principal.username],
    );

    const messagesWithAttachments = await Promise.all(messages.map(async (message) => ({
      ...message,
      attachment_path: await resolveAttachmentPath(message.file_lampiran),
    })));
    return NextResponse.json({ profile, announcements, materials, messages: messagesWithAttachments, reports, income: income[0] ?? null });
  } catch {
    return NextResponse.json({ message: "Unable to load employee dashboard" }, { status: 500 });
  }
}
