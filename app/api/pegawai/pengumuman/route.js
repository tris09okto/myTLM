import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Ambil hanya pengumuman yang aktif, urutkan dari yang terbaru
    const [rows] = await pool.execute(
      "SELECT * FROM pengumuman WHERE status = 'AKTIF' ORDER BY created_at DESC"
    );
    
    return NextResponse.json({ 
      success: true, 
      data: rows 
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching pengumuman for fronting:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Gagal memuat pengumuman." 
    }, { status: 500 });
  }
}