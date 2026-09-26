import { NextResponse } from 'next/server';

// PENTING: Sesuaikan path ini dengan lokasi file konfigurasi database Anda
// Biasanya terletak di 'lib/db.js', 'utils/db.js', atau 'config/db.js'
import {pool} from '@/lib/db'; 
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function POST(request) {
  let upload;
  let committed = false;
  try {
    const formData = await request.formData();
    
    // Ambil data dari form
    const judul = formData.get('judul');
    const kategori = formData.get('kategori');
    const deskripsi = formData.get('deskripsi');
    const file = formData.get('qna_file'); 

    // Validasi data
    if (!(file instanceof File) || !judul || !kategori) {
      return NextResponse.json(
        { success: false, message: 'Data QnA tidak lengkap!' }, 
        { status: 400 }
      );
    }

    // 1. PROSES SIMPAN FILE KE FOLDER SERVER
    // Buat nama file unik agar tidak tertimpa file lain
    const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    upload = await storeFileUpload({ file, folder: 'qna', localFileName: uniqueFileName });

    // 2. PROSES SIMPAN DATA KE DATABASE
    // Menggunakan query berparameter (?) untuk mencegah SQL Injection
    const query = `
      INSERT INTO qna_materi (judul, kategori, deskripsi, file_name) 
      VALUES (?, ?, ?, ?)
    `;
    
    // Jika deskripsi kosong, kita simpan string kosong ("")
    const values = [judul, kategori, deskripsi || "", upload.reference];

    // Eksekusi query (disesuaikan dengan module mysql2/promise)
    await pool.query(query, values);
    committed = true;

    // Kembalikan respon sukses ke frontend
    return NextResponse.json({ 
      success: true, 
      message: 'Materi QnA berhasil diunggah dan disimpan ke Database!' 
    });

  } catch (error) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
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
