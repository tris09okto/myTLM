import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        message: "ID data tidak ditemukan." 
      }, { status: 400 });
    }

    const query = `DELETE FROM produk_promo WHERE id = ?`;
    await pool.execute(query, [id]);

    return NextResponse.json({ 
      success: true, 
      message: "Data produk/promo berhasil dihapus!" 
    }, { status: 200 });

  } catch (error) {
    console.error("Error deleting produk/promo:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server saat menghapus data." 
    }, { status: 500 });
  }
}