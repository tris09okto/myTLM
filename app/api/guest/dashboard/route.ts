import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get("username") || "").trim();
    const date = (searchParams.get("date") || new Date().toISOString().split("T")[0]).trim();

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username mitra tidak ditemukan." },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      // 1. Cari profil mitra berdasarkan kode_mitra, email, atau nama_mitra
      const [mitraRows]: any = await connection.query(
        `SELECT id, kode_mitra, nama_mitra, email, no_telp, status 
         FROM mitra 
         WHERE LOWER(TRIM(kode_mitra)) = LOWER(TRIM(?)) 
            OR LOWER(TRIM(email)) = LOWER(TRIM(?)) 
            OR LOWER(TRIM(nama_mitra)) = LOWER(TRIM(?))
         LIMIT 1`,
        [username, username, username]
      );

      const idMitra = mitraRows[0]?.id || 1;

      // 2. Ambil daftar pegawai mitra beserta status kehadiran (HADIR / IZIN / BELUM_ABSEN)
      const [pegawaiRows]: any = await connection.query(
        `SELECT 
          nf.id,
          nf.id_mitra,
          nf.nama,
          nf.nik,
          nf.unit_kerja,
          nf.jabatan,
          nf.area_penempatan,
          nf.no_whatsapp,
          nf.tag_lokasi,
          nf.last_login_at,
          nf.status,
          MAX(pi.id) AS izin_id,
          MAX(pi.jenis_izin) AS jenis_izin,
          MAX(pi.alasan) AS alasan_izin,
          MAX(pi.file_bukti) AS file_bukti_izin,
          MAX(pi.approved_by) AS approved_by,
          CASE 
            WHEN MAX(pi.id) IS NOT NULL THEN 'IZIN'
            WHEN DATE(nf.last_login_at) = ? THEN 'HADIR'
            ELSE 'BELUM_ABSEN'
          END AS status_kehadiran
        FROM data_non_fronting nf
        LEFT JOIN pengajuan_izin pi 
          ON TRIM(nf.nik) = TRIM(pi.nik) 
          AND pi.status = 'DISETUJUI' 
          AND ? BETWEEN pi.tanggal_mulai AND pi.tanggal_selesai
        WHERE nf.id_mitra = ?
        GROUP BY nf.id
        ORDER BY nf.nama ASC`,
        [date, date, idMitra]
      );

      connection.release();

      // 3. Kalkulasi ringkasan statistik
      const totalPegawai = pegawaiRows.length;
      const totalHadir = pegawaiRows.filter((p: any) => p.status_kehadiran === "HADIR").length;
      const totalIzin = pegawaiRows.filter((p: any) => p.status_kehadiran === "IZIN").length;
      const totalBelumAbsen = pegawaiRows.filter((p: any) => p.status_kehadiran === "BELUM_ABSEN").length;

      return NextResponse.json({
        success: true,
        mitra: mitraRows[0] || {
          id: idMitra,
          kode_mitra: "MTR-0001",
          nama_mitra: "PT MITRA TESTING",
        },
        stats: {
          totalPegawai,
          totalHadir,
          totalIzin,
          totalBelumAbsen,
        },
        pegawaiList: pegawaiRows,
      });
    } catch (dbErr: any) {
      connection.release();
      console.error("Database error GET /api/mitra/dashboard:", dbErr);
      return NextResponse.json(
        { success: false, error: "Gagal mengambil data dashboard mitra: " + dbErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error GET /api/mitra/dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}