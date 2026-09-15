import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan dengan koneksi database Anda

export async function GET() {
  try {
    // Mencari aduan berdasarkan kategori yang diset untuk Super Admin
    const query = `SELECT * FROM qna_materi WHERE kategori = 'Aduan Super Admin' ORDER BY created_at DESC`;
    const [rows] = await pool.query(query);
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching laporan super admin:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, answer } = body;

    if (!id || !answer) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    const [rows] = await pool.query(`SELECT deskripsi FROM qna_materi WHERE id = ?`, [id]);
    
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Laporan tidak ditemukan' }, { status: 404 });
    }

    const oldDeskripsi = rows[0].deskripsi;
    
    // Pisahkan teks berdasarkan pemisah "Jawaban :"
    const parts = oldDeskripsi.split('\n\nJawaban :\n');
    const pertanyaanString = parts[0]; 

    // Gabungkan kembali dengan jawaban yang baru
    const newDeskripsi = `${pertanyaanString}\n\nJawaban :\n${answer}`;

    // Update database
    await pool.query(`UPDATE qna_materi SET deskripsi = ? WHERE id = ?`, [newDeskripsi, id]);

    return NextResponse.json({ success: true, message: 'Balasan berhasil dikirim.' });
  } catch (error) {
    console.error('Error updating laporan super admin:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}