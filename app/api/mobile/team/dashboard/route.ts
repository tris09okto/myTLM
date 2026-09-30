import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveUploadUrl } from "@/lib/mobile/attachment-path";

export const runtime = "nodejs";

interface LeaderRow extends RowDataPacket {
  nama_leader: string;
  kanwil: string;
  area: string;
  penempatan: string;
  idcard_file: string | null;
}

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "leader" && principal.role !== "supervisor")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    if (principal.role === "leader") {
      const [profiles] = await pool.query<LeaderRow[]>(
        `SELECT nama_leader, kanwil, area, penempatan, idcard_file FROM data_leader
         WHERE username = ? LIMIT 1`,
        [principal.username],
      );
      const profile = profiles[0];
      if (!profile) return NextResponse.json({ message: "Leader profile not found" }, { status: 404 });

      const [team] = await pool.query<RowDataPacket[]>(
        `SELECT p.nik, p.nama, p.area, p.penempatan,
                COALESCE(SUM(e.up_pengajuan), 0) AS totalClosing
         FROM master_pegawai p
         LEFT JOIN entri_data_perkiraan_pemasukan e
           ON p.nik = e.nik_fronting AND e.status LIKE '%Close'
         WHERE p.leader = ?
         GROUP BY p.nik, p.nama, p.area, p.penempatan ORDER BY p.nama`,
        [profile.nama_leader],
      );
      const [reports] = await pool.query<RowDataPacket[]>(
        `SELECT id, judul, deskripsi, file_name, created_at FROM qna_materi
         WHERE judul LIKE ? ORDER BY created_at DESC`,
        [`%[Aduan Leader ${profile.nama_leader}]%`],
      );
      return NextResponse.json({
        kind: "leader",
        profile: {
          name: profile.nama_leader,
          area: profile.area,
          kanwil: profile.kanwil,
          penempatan: profile.penempatan,
          idcard_file: profile.idcard_file,
          idcard_file_url: await resolveUploadUrl(profile.idcard_file, "leader/idcard"),
        },
        team,
        totalClosing: team.reduce((total, member) => total + Number(member.totalClosing), 0),
        reports: await Promise.all(reports.map(async (report) => ({
          ...report,
          file_url: await resolveUploadUrl(report.file_name, "qna"),
        }))),
      });
    }

    const [team] = await pool.query<RowDataPacket[]>(
      `SELECT nik, nama, jabatan, unit_kerja, area_penempatan
       FROM data_non_fronting WHERE supervisor = ? ORDER BY nama`,
      [principal.username],
    );
    const [reports] = await pool.query<RowDataPacket[]>(
      `SELECT l.id, l.nik, l.nama, l.pesan AS deskripsi,
              l.foto AS file_name, l.created_at
       FROM laporan_aduan l
       JOIN data_non_fronting d ON l.nik = d.nik
       WHERE d.supervisor = ? ORDER BY l.created_at DESC`,
      [principal.username],
    );
    return NextResponse.json({
      kind: "supervisor",
      profile: { name: principal.username, area: "-" },
      team,
      reports: await Promise.all(reports.map(async (report) => ({
        ...report,
        file_url: await resolveUploadUrl(report.file_name, "non-fronting"),
      }))),
    });
  } catch {
    return NextResponse.json({ message: "Unable to load team dashboard" }, { status: 500 });
  }
}
