import { NextResponse } from "next/server";
import { pool } from "@/lib/db"; // Sesuaikan dengan koneksi database MySQL Anda

export async function POST(req: Request) {
  try {
    const { nik, tagLokasi } = await req.json();

    if (!nik || !tagLokasi) {
      return NextResponse.json(
        { success: false, message: "NIK dan Tag Lokasi wajib diisi" },
        { status: 400 }
      );
    }

    // Update tag_lokasi dan last_login_at (tanggal & waktu login terbaru)
    const [result]: any = await pool.query(
      "UPDATE data_non_fronting SET tag_lokasi = ?, last_login_at = NOW() WHERE nik = ?",
      [tagLokasi, nik]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Pegawai non-fronting tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Tag lokasi dan waktu login berhasil diperbarui",
    });
  } catch (error: any) {
    console.error("Gagal update lokasi & waktu login:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}