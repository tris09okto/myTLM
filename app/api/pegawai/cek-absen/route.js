import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const nik = searchParams.get('nik');

    if (!nik) {
      return NextResponse.json({ success: false, error: 'NIK diperlukan' }, { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT waktu_masuk, waktu_keluar FROM absensi WHERE nik = ? AND tanggal = CURDATE() LIMIT 1`,
      [nik]
    );

    let sudahMasuk = false;
    let sudahPulang = false;

    if (rows.length > 0) {
      sudahMasuk = rows[0].waktu_masuk !== null;
      sudahPulang = rows[0].waktu_keluar !== null;
    }

    return NextResponse.json({ success: true, sudahMasuk, sudahPulang });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}