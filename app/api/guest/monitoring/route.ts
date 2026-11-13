import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get("username") || "").trim();
    const date = (searchParams.get("date") || "").trim();
    const search = (searchParams.get("search") || "").trim();
    const mitraId = (searchParams.get("mitra") || "ALL").trim();

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username guest diperlukan." },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      const targetDate = date || new Date().toISOString().split("T")[0];

      let query = `
        SELECT 
          nf.id,
          nf.nik,
          nf.nama,
          nf.unit_kerja,
          nf.last_login_at,
          nf.tag_lokasi,
          nf.id_mitra,
          m.nama_mitra,
          MAX(pi.jenis_izin) AS jenis_izin,
          MAX(pi.alasan) AS alasan_izin,
          MAX(pi.file_bukti) AS file_bukti_izin,
          CASE 
            WHEN MAX(pi.id) IS NOT NULL THEN 'IZIN'
            WHEN DATE(nf.last_login_at) = ? THEN 'HADIR'
            ELSE 'BELUM_ABSEN'
          END AS status_kehadiran
        FROM data_non_fronting nf
        LEFT JOIN mitra m ON nf.id_mitra = m.id
        LEFT JOIN pengajuan_izin pi 
          ON TRIM(nf.nik) = TRIM(pi.nik)
          AND pi.status = 'DISETUJUI'
          AND ? BETWEEN pi.tanggal_mulai AND pi.tanggal_selesai
        WHERE (DATE(nf.last_login_at) = ? OR pi.id IS NOT NULL)
      `;

      const queryParams: any[] = [targetDate, targetDate, targetDate];

      if (mitraId !== "ALL") {
        query += ` AND (nf.id_mitra = ? OR LOWER(TRIM(m.nama_mitra)) = LOWER(TRIM(?)))`;
        queryParams.push(mitraId, mitraId);
      }

      if (search) {
        query += ` AND (nf.nama LIKE ? OR nf.nik LIKE ? OR m.nama_mitra LIKE ?)`;
        const searchKeyword = `%${search}%`;
        queryParams.push(searchKeyword, searchKeyword, searchKeyword);
      }

      query += ` GROUP BY nf.id ORDER BY nf.last_login_at DESC`;

      const [rows]: any = await connection.query(query, queryParams);

      connection.release();

      return NextResponse.json({
        success: true,
        data: rows,
      });
    } catch (dbErr: any) {
      connection.release();
      console.error("Database error GET /api/guest/monitoring:", dbErr);
      return NextResponse.json(
        { success: false, error: "Gagal mengambil data monitoring: " + dbErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error GET /api/guest/monitoring:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}