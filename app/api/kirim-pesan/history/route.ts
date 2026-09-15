import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pihak1 = searchParams.get('pihak1'); // Contoh: NIK Pegawai (misal: "19901009...")
    const pihak2 = searchParams.get('pihak2'); // Contoh: Role atau NIK lawan bicara (misal: "MO")

    if (!pihak1 || !pihak2) {
      return NextResponse.json({ success: false, message: 'Parameter pihak1 dan pihak2 wajib diisi.' }, { status: 400 });
    }

    // Kueri dua arah: Mengambil pesan dari pihak1 ke pihak2, ATAU dari pihak2 ke pihak1
    const [rows] = await pool.query(
      `SELECT * FROM pesan_notifikasi 
       WHERE (pengirim_role = ? AND penerima_nik = ?) 
          OR (pengirim_role = ? AND penerima_nik = ?) 
       ORDER BY created_at ASC`,
      [pihak1, pihak2, pihak2, pihak1]
    );

    return NextResponse.json({ success: true, data: rows }, { status: 200 });
  } catch (error) {
    console.error('Gagal mengambil history pesan:', error);
    return NextResponse.json({ success: false, message: 'Kesalahan internal server' }, { status: 500 });
  }
}