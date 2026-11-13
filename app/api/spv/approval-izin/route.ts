import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// ==========================================
// 1. GET: Ambil Daftar Pengajuan Izin Tim SPV
// ==========================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const spvName = (searchParams.get("spvName") || "").trim();
    const username = (searchParams.get("username") || "").trim();
    const nik = (searchParams.get("nik") || "").trim();

    if (!spvName && !username && !nik) {
      return NextResponse.json(
        { success: false, message: "Identitas Supervisor tidak ditemukan." },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      // Kumpulkan seluruh kemungkinan identitas SPV (nama, username, nik)
      const identifierSet = new Set<string>();
      [spvName, username, nik].forEach((val) => {
        if (val) identifierSet.add(val.toLowerCase());
      });

      // Cari profil SPV di data_non_fronting agar nama, username, dan nik-nya ikut terdeteksi
      const lookupKeys = Array.from(identifierSet);
      if (lookupKeys.length > 0) {
        const placeholders = lookupKeys.map(() => "?").join(", ");
        const [spvRows]: any = await connection.query(
          `SELECT nik, username, nama 
           FROM data_non_fronting 
           WHERE LOWER(TRIM(nik)) IN (${placeholders})
              OR LOWER(TRIM(username)) IN (${placeholders})
              OR LOWER(TRIM(nama)) IN (${placeholders})`,
          [...lookupKeys, ...lookupKeys, ...lookupKeys]
        );

        spvRows.forEach((row: any) => {
          if (row.nik) identifierSet.add(String(row.nik).trim().toLowerCase());
          if (row.username) identifierSet.add(String(row.username).trim().toLowerCase());
          if (row.nama) identifierSet.add(String(row.nama).trim().toLowerCase());
        });
      }

      const finalIdentifiers = Array.from(identifierSet);
      const inPlaceholders = finalIdentifiers.map(() => "?").join(", ");

      // Join pengajuan_izin dengan data_non_fronting berdasarkan NIK pegawai
      const [rows]: any = await connection.query(
        `SELECT 
          i.*,
          COALESCE(p.nama, i.nik) AS nama,
          p.unit_kerja,
          p.jabatan,
          p.supervisor
         FROM pengajuan_izin i
         LEFT JOIN data_non_fronting p ON TRIM(i.nik) = TRIM(p.nik)
         WHERE LOWER(TRIM(p.supervisor)) IN (${inPlaceholders})
         ORDER BY i.id DESC`,
        finalIdentifiers
      );

      connection.release();

      return NextResponse.json({
        success: true,
        data: rows,
      });
    } catch (dbErr: any) {
      connection.release();
      console.error("Database error GET /api/spv/approval-izin:", dbErr);
      return NextResponse.json(
        { success: false, message: "Gagal mengambil data izin: " + dbErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error GET /api/spv/approval-izin:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. PUT: Proses Setujui / Tolak Izin oleh SPV
// ==========================================
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status, catatan_spv, approved_by } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: "ID pengajuan dan status wajib diisi." },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Cek kolom yang tersedia di tabel pengajuan_izin agar aman dari ER_BAD_FIELD_ERROR
      const [columnsRows]: any = await connection.query(`SHOW COLUMNS FROM pengajuan_izin`);
      const existingCols = new Set(
        columnsRows.map((col: any) => String(col.Field).toLowerCase())
      );

      const updates: string[] = ["status = ?"];
      const values: any[] = [status];

      if (existingCols.has("catatan_spv")) {
        updates.push("catatan_spv = ?");
        values.push(catatan_spv || null);
      }
      if (existingCols.has("approved_by")) {
        updates.push("approved_by = ?");
        values.push(approved_by || null);
      }
      if (existingCols.has("updated_at")) {
        updates.push("updated_at = NOW()");
      }

      values.push(id);

      await connection.query(
        `UPDATE pengajuan_izin SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      // Ambil NIK pegawai untuk mengirim notifikasi hasil approval
      const [izinRows]: any = await connection.query(
        `SELECT nik, jenis_izin, tanggal_mulai, tanggal_selesai FROM pengajuan_izin WHERE id = ? LIMIT 1`,
        [id]
      );

      if (izinRows.length > 0) {
        const izin = izinRows[0];
        const statusLabel = status === "DISETUJUI" ? "DISETUJUI" : "DITOLAK";
        const kontenPesan = `Pengajuan ${izin.jenis_izin || "Izin"} (${izin.tanggal_mulai} s.d. ${izin.tanggal_selesai || izin.tanggal_mulai}) telah ${statusLabel} oleh Supervisor.${catatan_spv ? ` Catatan: ${catatan_spv}` : ""}`;

        await connection.query(
          `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
           VALUES ('Supervisor', ?, 'Approval Izin', ?, 0, NOW())`,
          [izin.nik, kontenPesan]
        );
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        message: `Pengajuan izin berhasil ${status === "DISETUJUI" ? "disetujui" : "ditolak"}.`,
      });
    } catch (dbErr: any) {
      await connection.rollback();
      connection.release();
      console.error("Database error PUT /api/spv/approval-izin:", dbErr);
      return NextResponse.json(
        { success: false, message: "Gagal memperbarui status izin: " + dbErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error PUT /api/spv/approval-izin:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}