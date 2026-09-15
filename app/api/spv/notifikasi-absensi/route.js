import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username diperlukan' }, { status: 400 });
    }

    const [rows] = await pool.query(`
      SELECT * FROM pesan_notifikasi 
      WHERE penerima_nik = ? 
      ORDER BY created_at DESC 
      LIMIT 30
    `, [username]);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching SPV notifikasi:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { username, id } = body;

    // Jika ada ID, tandai 1 notifikasi spesifik menjadi sudah dibaca
    if (id) {
      await pool.query(`UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ?`, [id]);
      return NextResponse.json({ success: true, message: 'Notifikasi ditandai dibaca' });
    }

    // Jika hanya username, tandai semua milik user tersebut menjadi dibaca
    if (username) {
      await pool.query(`UPDATE pesan_notifikasi SET is_read = 1 WHERE penerima_nik = ? AND is_read = 0`, [username]);
      return NextResponse.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
    }

    return NextResponse.json({ success: false, error: 'Parameter tidak valid' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}