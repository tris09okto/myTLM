import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan dengan koneksi database Anda

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leaderName = searchParams.get('leaderName');

  if (!leaderName) {
    return NextResponse.json({ success: false, message: 'Nama leader tidak valid' }, { status: 400 });
  }

  try {
    // Mencari aduan berdasarkan nama leader yang terselip di kolom judul
    const query = `SELECT * FROM qna_materi WHERE judul LIKE ? ORDER BY created_at DESC`;
    const values = [`%[Aduan Leader ${leaderName}]%`];
    
    // Sesuaikan eksekusi query dengan library DB Anda (contoh ini menggunakan mysql2/promise)
    const [rows] = await pool.query(query, values);
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching laporan:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, answer } = body;

    if (!id || !answer) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    // 1. Ambil deskripsi lama untuk mempertahankan teks Pertanyaan
    const [rows]: any = await pool.query(`SELECT deskripsi FROM qna_materi WHERE id = ?`, [id]);
    
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Laporan tidak ditemukan' }, { status: 404 });
    }

    const oldDeskripsi = rows[0].deskripsi;
    
    // 2. Pisahkan teks berdasarkan pemisah "Jawaban :"
    const parts = oldDeskripsi.split('\n\nJawaban :\n');
    const pertanyaanString = parts[0]; // Ini berisi "Pertanyaan :\n[Isi pesan...]"

    // 3. Gabungkan kembali dengan jawaban yang baru
    const newDeskripsi = `${pertanyaanString}\n\nJawaban :\n${answer}`;

    // 4. Update database
    await pool.query(`UPDATE qna_materi SET deskripsi = ? WHERE id = ?`, [newDeskripsi, id]);

    return NextResponse.json({ success: true, message: 'Balasan berhasil dikirim.' });
  } catch (error: any) {
    console.error('Error updating laporan:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}