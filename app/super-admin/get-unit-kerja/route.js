import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT id, nama_unit FROM master_unit_kerja ORDER BY nama_unit ASC');
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching unit kerja:', error);
    return NextResponse.json({ success: false, message: 'Kesalahan sistem' }, { status: 500 });
  }
}