import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan path koneksi database Anda

export async function GET(request) {
  try {
    // Ambil semua pesan/laporan yang ditujukan untuk DIREKTUR
    // (Berdasarkan nik_tujuan bernilai 'DIREKTUR' atau pengirim dari role terkait)
    const [rows] = await pool.query(`
      SELECT 
        id,
        pengirim_role,
        tipe_pesan,
        konten,
        file_lampiran,
        file_sanggahan,
        tanggapan_direktur,
        created_at,
        is_read
      FROM notifikasi
      WHERE nik_tujuan = 'DIREKTUR' OR tipe_pesan LIKE '%Laporan ke Direktur%'
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Gagal mengambil laporan masuk direktur:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' }, 
      { status: 500 }
    );
  }
}