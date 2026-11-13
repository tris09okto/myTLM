import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();

    const connection = await pool.getConnection();

    try {
      const query = `
        SELECT 
          m.id,
          m.kode_mitra,
          m.nama_mitra,
          m.email,
          m.no_telp,
          m.alamat_mitra,
          m.status,
          COUNT(nf.id) AS total_pegawai
        FROM mitra m
        LEFT JOIN data_non_fronting nf ON m.id = nf.id_mitra
        WHERE m.nama_mitra LIKE ? OR m.kode_mitra LIKE ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `;

      const searchKeyword = `%${search}%`;
      const [rows]: any = await connection.query(query, [searchKeyword, searchKeyword]);

      connection.release();

      return NextResponse.json({
        success: true,
        data: rows,
      });
    } catch (dbErr: any) {
      connection.release();
      console.error("Database error GET /api/guest/mitra:", dbErr);
      return NextResponse.json(
        { success: false, error: "Gagal mengambil data mitra: " + dbErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error GET /api/guest/mitra:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}