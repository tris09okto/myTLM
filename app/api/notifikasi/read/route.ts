import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    
    if (!id) return NextResponse.json({ error: 'ID pesan diperlukan' }, { status: 400 });

    await pool.query('UPDATE pesan_notifikasi SET is_read = TRUE WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update Notifikasi Error:', error);
    return NextResponse.json({ error: 'Gagal update status notifikasi' }, { status: 500 });
  }
}