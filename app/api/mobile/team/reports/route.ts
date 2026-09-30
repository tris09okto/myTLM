import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface LeaderRow extends RowDataPacket { nama_leader: string }
interface ReportRow extends RowDataPacket { deskripsi: string; nik: string; pesan: string; nama: string }

export async function PUT(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || (principal.role !== "leader" && principal.role !== "supervisor")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("id" in body) || !("answer" in body) ||
      typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0 ||
      typeof body.answer !== "string" || !body.answer.trim() || body.answer.length > 5000) {
    return NextResponse.json({ message: "Invalid reply" }, { status: 400 });
  }

  try {
    if (principal.role === "leader") {
      const [leaders] = await pool.query<LeaderRow[]>(
        "SELECT nama_leader FROM data_leader WHERE username = ? LIMIT 1", [principal.username],
      );
      const name = leaders[0]?.nama_leader;
      if (!name) return NextResponse.json({ message: "Leader profile not found" }, { status: 404 });
      const [reports] = await pool.query<ReportRow[]>(
        "SELECT deskripsi FROM qna_materi WHERE id = ? AND judul LIKE ? LIMIT 1",
        [body.id, `%[Aduan Leader ${name}]%`],
      );
      const report = reports[0];
      if (!report) return NextResponse.json({ message: "Report not found" }, { status: 404 });
      const question = report.deskripsi.split("\n\nJawaban :\n")[0];
      await pool.query("UPDATE qna_materi SET deskripsi = ? WHERE id = ?", [
        `${question}\n\nJawaban :\n${body.answer.trim()}`, body.id,
      ]);
    } else {
      const [reports] = await pool.query<ReportRow[]>(
        `SELECT l.nik, l.nama, l.pesan FROM laporan_aduan l
         JOIN data_non_fronting d ON l.nik = d.nik
         WHERE l.id = ? AND d.supervisor = ? LIMIT 1`,
        [body.id, principal.username],
      );
      const report = reports[0];
      if (!report) return NextResponse.json({ message: "Report not found" }, { status: 404 });
      const answer = body.answer.trim();
      await pool.query("UPDATE laporan_aduan SET pesan = ? WHERE id = ?", [
        `${report.pesan}\n\nJawaban SPV :\n${answer}`, body.id,
      ]);
      await pool.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
         VALUES (?, ?, 'Balasan Laporan Pegawai', ?, 0, NOW())`,
        [principal.username, report.nik, `[Balasan ${principal.username}] Tanggapan untuk laporan Anda: "${answer}"`],
      );
      await pool.query(
        `UPDATE pesan_notifikasi SET konten = CONCAT(konten, ?), is_read = 0
         WHERE penerima_nik = 'MO' AND tipe_pesan = 'Laporan Pegawai' AND konten LIKE ?`,
        [`\n\n[Respon Supervisor: ${principal.username}]\n"${answer}"`, `%${report.nik}%`],
      );
    }
    return NextResponse.json({ success: true, message: "Balasan berhasil dikirim." });
  } catch {
    return NextResponse.json({ message: "Unable to send reply" }, { status: 500 });
  }
}
