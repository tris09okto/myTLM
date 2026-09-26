import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveUploadUrl } from "@/lib/mobile/attachment-path";

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
    const [areas] = await pool.query<RowDataPacket[]>(
      "SELECT kanwil, area, penempatan FROM master_wilayah ORDER BY kanwil, area, penempatan",
    );
    const [announcements] = await pool.query<RowDataPacket[]>(
      `SELECT id, judul, isi, file_lampiran, status, jenis_pengumuman, target_penerima, created_at
       FROM pengumuman ORDER BY created_at DESC`,
    );
    const [products] = await pool.query<RowDataPacket[]>(
      `SELECT id, tipe, judul, deskripsi, gambar_file, status, berlaku_sampai, created_at
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
    const [frontingWithUrls, nonFrontingWithUrls, leadersWithUrls, announcementsWithUrls, productsWithUrls, reportsWithUrls, materialsWithUrls] = await Promise.all([
      Promise.all(fronting.map(async (employee) => ({
        ...employee,
        idcard_file_url: await resolveUploadUrl(employee.idcard_file, ""),
        st_file_urls: await Promise.all((employee.st_file ?? "").split(",").map((entry: string) =>
          resolveUploadUrl(entry.trim(), ""))),
      }))),
      Promise.all(nonFronting.map(async (employee) => ({
        ...employee,
        pas_foto_url: await resolveUploadUrl(employee.pas_foto, "pas_foto"),
        surat_tugas_url: await resolveUploadUrl(employee.surat_tugas, "surat_tugas"),
      }))),
      Promise.all(leaders.map(async (leader) => ({
        ...leader,
        idcard_file_url: await resolveUploadUrl(leader.idcard_file, "leader/idcard"),
      }))),
      Promise.all(announcements.map(async (announcement) => ({
        ...announcement,
        file_lampiran_url: await resolveUploadUrl(announcement.file_lampiran, "super-admin/pengumuman"),
      }))),
      Promise.all(products.map(async (product) => ({
        ...product,
        gambar_file_url: await resolveUploadUrl(product.gambar_file, "super-admin/produk"),
      }))),
      Promise.all(reports.map(async (report) => ({
        ...report,
        file_url: await resolveUploadUrl(report.file_name, "qna"),
      }))),
      Promise.all(materials.map(async (material) => ({
        ...material,
        file_url: await resolveUploadUrl(material.file_name, "qna"),
      }))),
    ]);
    return NextResponse.json({
      fronting: frontingWithUrls,
      nonFronting: nonFrontingWithUrls,
      leaders: leadersWithUrls,
      areas,
      announcements: announcementsWithUrls,
      products: productsWithUrls,
      reports: reportsWithUrls,
      materials: materialsWithUrls,
    });
  } catch {
    return NextResponse.json({ message: "Unable to load super admin dashboard" }, { status: 500 });
  }
}
