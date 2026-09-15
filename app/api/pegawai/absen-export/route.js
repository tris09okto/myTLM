import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bulan = searchParams.get('bulan'); // format: YYYY-MM
    const leader = searchParams.get('supervisor'); // (opsional) jika difilter per leader

    let query = `SELECT nik, nama, unit_kerja, nama_supervisor, tanggal, waktu_masuk, waktu_keluar, lokasi, status FROM absensi WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?`;
    let params = [bulan];

    if (leader) {
      query += ` AND nama_supervisor = ?`;
      params.push(leader);
    }

    query += ` ORDER BY tanggal ASC, waktu_masuk ASC`;

    const [rows] = await pool.query(query, params);
    return NextResponse.json({ success: true, data: rows });

  } catch (error) {
    console.error('Error export absensi:', error);
    return NextResponse.json({ success: false, message: 'Gagal menarik data.' }, { status: 500 });
  }
}