import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Sesuaikan dengan koneksi database Anda
import { resolveUploadUrl } from '@/lib/mobile/attachment-path';

export async function GET() {
  try {
    // Di sini Anda akan melakukan query ke database, misalnya:
    const [rows] = await pool.query('SELECT * FROM qna_materi ORDER BY created_at DESC');

    return NextResponse.json({
      success: true,
      data: await Promise.all(rows.map(async (material) => ({
        ...material,
        file_url: await resolveUploadUrl(material.file_name, "qna"),
      }))),
    });
  } catch (error) {
    console.error("Error fetching QnA:", error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data materi QnA.' }, 
      { status: 500 }
    );
  }
}
