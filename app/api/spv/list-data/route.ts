import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

interface SupervisorRow extends RowDataPacket {
  id: number;
  id_mitra: number | null;
  nama: string;
  nik: string;
  unit_kerja: string;
  jenis_kelamin: string;
  area_penempatan: string;
  alamat_area_penempatan: string;
  status_pernikahan: string;
  golongan_darah: string | null;
  masa_kerja: string;
  tanggal_mulai_kerja: Date | string | null;
  masa_kontrak: string | null;
  jabatan: string;
  domisili: string;
  email: string;
  tempat_lahir: string;
  tanggal_lahir: Date | string | null;
  no_whatsapp: string;
  pas_foto: string;
  surat_tugas: string;
  username: string;
  supervisor: string | null;
  tag_lokasi: string | null;
  status: "AKTIF" | "NON-AKTIF";
  nama_mitra: string | null;
}

function formatDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(value).trim();
  return str.length >= 10 ? str.slice(0, 10) : "";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role?.toUpperCase() !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak" },
        { status: 403 }
      );
    }

    const [rows] = await pool.query<SupervisorRow[]>(
      `SELECT 
         dnf.id,
         dnf.id_mitra,
         dnf.nama,
         dnf.nik,
         dnf.unit_kerja,
         dnf.jenis_kelamin,
         dnf.area_penempatan,
         dnf.alamat_area_penempatan,
         dnf.status_pernikahan,
         dnf.golongan_darah,
         dnf.masa_kerja,
         dnf.tanggal_mulai_kerja,
         dnf.masa_kontrak,
         dnf.jabatan,
         dnf.domisili,
         dnf.email,
         dnf.tempat_lahir,
         dnf.tanggal_lahir,
         dnf.no_whatsapp,
         dnf.pas_foto,
         dnf.surat_tugas,
         dnf.username,
         dnf.supervisor,
         dnf.tag_lokasi,
         dnf.status,
         m.nama_mitra
       FROM data_non_fronting dnf
       LEFT JOIN mitra m ON dnf.id_mitra = m.id
       WHERE UPPER(dnf.jabatan) = 'SUPERVISOR'
       ORDER BY dnf.id DESC`
    );

    const supervisors = rows.map((row) => ({
      id: row.id,
      mitra_id: row.id_mitra,
      id_mitra: row.id_mitra,
      nama: row.nama ?? "",
      nik: row.nik ?? "",
      unit_kerja: row.unit_kerja ?? "",
      jenis_kelamin: row.jenis_kelamin ?? "",
      area_penempatan: row.area_penempatan ?? "",
      alamat_area_penempatan: row.alamat_area_penempatan ?? "",
      status_pernikahan: row.status_pernikahan ?? "",
      golongan_darah: row.golongan_darah ?? "",
      masa_kerja: row.masa_kerja ?? "",
      tanggal_mulai_kerja: formatDateInput(row.tanggal_mulai_kerja),
      masa_kontrak: row.masa_kontrak ?? "",
      jabatan: row.jabatan ?? "SUPERVISOR",
      domisili: row.domisili ?? "",
      email: row.email ?? "",
      tempat_lahir: row.tempat_lahir ?? "",
      tanggal_lahir: formatDateInput(row.tanggal_lahir),
      no_hp: row.no_whatsapp ?? "",
      no_whatsapp: row.no_whatsapp ?? "",
      pas_foto: row.pas_foto ?? "",
      surat_tugas: row.surat_tugas ?? "",
      username: row.username ?? "",
      tag_lokasi: row.tag_lokasi ?? "",
      status: row.status ?? "AKTIF",
      mitra: row.id_mitra
        ? { id: row.id_mitra, nama_mitra: row.nama_mitra ?? "" }
        : null,
    }));

    return NextResponse.json({ success: true, data: supervisors });
  } catch (error) {
    console.error("GET /api/spv/list-data error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memuat daftar supervisor" },
      { status: 500 }
    );
  }
}