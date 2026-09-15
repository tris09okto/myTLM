import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT id, nama, nik, jabatan, unit_kerja, area_penempatan, username, no_whatsapp FROM data_non_fronting ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetch non-fronting:', error);
    return NextResponse.json({ success: false, message: 'Kesalahan sistem', error: error.message }, { status: 500 });
  }
}