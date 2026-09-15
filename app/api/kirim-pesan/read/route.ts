import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID pesan diperlukan' }, { status: 400 });
    }

    await pool.query('UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: 'Pesan ditandai sudah dibaca' });
  } catch (error: any) {
    console.error("Error updating read status:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}