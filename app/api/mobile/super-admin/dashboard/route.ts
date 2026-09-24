import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "super_admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const [fronting] = await pool.query<RowDataPacket[]>(
      `SELECT id, nama, nik, kanwil, area, penempatan, leader, email, nowa,
              nama_bank, norek, username, idcard_file, st_file FROM master_pegawai ORDER BY nama`,
    );
    const [nonFronting] = await pool.query<RowDataPacket[]>(
      `SELECT id, nama, nik, jabatan, unit_kerja, area_penempatan, supervisor, username,
              pas_foto, surat_tugas
       FROM data_non_fronting ORDER BY nama`,
    );
    const [leaders] = await pool.query<RowDataPacket[]>(
      "SELECT id, nama_leader, kanwil, area, penempatan, email, username, idcard_file FROM data_leader ORDER BY nama_leader",
    );
    const [announcements] = await pool.query<RowDataPacket[]>(
      `SELECT id, judul, isi, status, jenis_pengumuman, target_penerima, created_at
       FROM pengumuman ORDER BY created_at DESC`,
    );
    const [products] = await pool.query<RowDataPacket[]>(
      `SELECT id, tipe, judul, deskripsi, status, berlaku_sampai, created_at
       FROM produk_promo ORDER BY created_at DESC`,
    );
    const [reports] = await pool.query<RowDataPacket[]>(
      `SELECT id, judul, deskripsi, file_name, created_at
       FROM qna_materi WHERE kategori = 'Aduan Super Admin' ORDER BY created_at DESC`,
    );
    const [materials] = await pool.query<RowDataPacket[]>(
      `SELECT id, judul, kategori, deskripsi, file_name, created_at
       FROM qna_materi WHERE kategori IN ('Produk', 'Promo', 'Sistem') ORDER BY created_at DESC`,
    );
    return NextResponse.json({ fronting, nonFronting, leaders, announcements, products, reports, materials });
  } catch {
    return NextResponse.json({ message: "Unable to load super admin dashboard" }, { status: 500 });
  }
}
