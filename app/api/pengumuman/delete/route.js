import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, message: "ID tidak valid." }, { status: 400 });

    await pool.execute('DELETE FROM pengumuman WHERE id = ?', [id]);

    return NextResponse.json({ success: true, message: "Pengumuman berhasil dihapus!" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting pengumuman:", error);
    return NextResponse.json({ success: false, message: "Gagal menghapus pengumuman." }, { status: 500 });
  }
}