import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Sesuaikan dengan koneksi database Anda

export async function GET() {
  try {
    // Di sini Anda akan melakukan query ke database, misalnya:
    const [rows] = await pool.query('SELECT * FROM qna_materi ORDER BY created_at DESC');

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching QnA:", error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data materi QnA.' }, 
      { status: 500 }
    );
  }
}