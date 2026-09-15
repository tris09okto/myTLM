import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

// PENTING: Sesuaikan path ini dengan lokasi file konfigurasi database Anda
// Biasanya terletak di 'lib/db.js', 'utils/db.js', atau 'config/db.js'
import {pool} from '@/lib/db'; 

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Ambil data dari form
    const judul = formData.get('judul');
    const kategori = formData.get('kategori');
    const deskripsi = formData.get('deskripsi');
    const file = formData.get('qna_file'); 

    // Validasi data
    if (!file || !judul || !kategori) {
      return NextResponse.json(
        { success: false, message: 'Data QnA tidak lengkap!' }, 
        { status: 400 }
      );
    }

    // 1. PROSES SIMPAN FILE KE FOLDER SERVER
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Buat nama file unik agar tidak tertimpa file lain
    const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    
    const uploadDir = path.join(process.cwd(), 'public/uploads/qna');
    const filePath = path.join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);

    // 2. PROSES SIMPAN DATA KE DATABASE
    // Menggunakan query berparameter (?) untuk mencegah SQL Injection
    const query = `
      INSERT INTO qna_materi (judul, kategori, deskripsi, file_name) 
      VALUES (?, ?, ?, ?)
    `;
    
    // Jika deskripsi kosong, kita simpan string kosong ("")
    const values = [judul, kategori, deskripsi || "", uniqueFileName];

    // Eksekusi query (disesuaikan dengan module mysql2/promise)
    await pool.query(query, values);

    // Kembalikan respon sukses ke frontend
    return NextResponse.json({ 
      success: true, 
      message: 'Materi QnA berhasil diunggah dan disimpan ke Database!' 
    });

  } catch (error) {
    console.error("Error Upload QnA:", error);
    
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { success: false, message: 'Folder public/uploads/qna belum dibuat di server!' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan internal server atau database.' }, 
      { status: 500 }
    );
  }
}