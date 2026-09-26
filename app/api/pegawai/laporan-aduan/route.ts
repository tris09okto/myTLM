import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db'; // Sesuaikan path import database Anda
import { v2 as cloudinary } from 'cloudinary';

// Konfigurasi Cloudinary (Otomatis mengambil dari environment variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const target = formData.get('target') as string;
    const pesan = formData.get('pesan') as string;
    const nik = formData.get('nik') as string;
    const nama = formData.get('nama') as string;
    const nama_leader = formData.get('nama_leader') as string;
    const foto = formData.get('foto') as File | null;

    if (!pesan || !nik) {
      return NextResponse.json(
        { success: false, message: 'Pesan dan data user tidak valid.' },
        { status: 400 }
      );
    }

    let fileName = ''; // Gunakan string kosong jika tidak ada file (sesuai varchar database)

    if (foto && foto.size > 0) {
      const bytes = await foto.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const originalName = foto.name.replace(/\s+/g, '_');
      const ext = originalName.split('.').pop();
      const generatedName = `laporan-${nik}-${Date.now()}`;
      
      const targetFolder = 'uploads/qna'; // Nama folder yang akan digunakan

      if (process.env.NODE_ENV === 'production') {
        // ==========================================
        // MODE PRODUCTION: UPLOAD KE CLOUDINARY
        // ==========================================
        const fileType = foto.type || '';
        const isImage = fileType.startsWith('image/');
        const resourceType = isImage ? 'image' : 'raw';
        
        // Untuk Cloudinary, tipe 'raw' wajib menyertakan ekstensi file pada public_id
        const finalPublicId = isImage ? generatedName : `${generatedName}.${ext}`;

        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { 
              folder: targetFolder, 
              resource_type: resourceType, 
              public_id: finalPublicId 
            },
            (error, result) => {
              if (error) {
                console.error("Cloudinary Upload Error:", error);
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          uploadStream.end(buffer);
        });

        // Menyimpan full URL dari Cloudinary ke database
        fileName = (uploadResult as any).secure_url;

      } else {
        // ==========================================
        // MODE DEVELOPMENT: UPLOAD KE FOLDER LOKAL
        // ==========================================
        fileName = `${generatedName}.${ext}`;
        
        const uploadDir = path.join(process.cwd(), 'public', ...targetFolder.split('/'));
        await mkdir(uploadDir, { recursive: true });
        
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
      }
    }

    // 1. FORMAT JUDUL & KATEGORI
    // Menyisipkan nama pengirim dan target ke Judul agar bisa difilter di halaman Leader/Admin
    const judulLaporan = `[Aduan ${target === 'leader' ? 'Leader ' + nama_leader : 'Super Admin'}] dari ${nama} (${nik})`;
    const kategoriLaporan = target === 'leader' ? 'Aduan Leader' : 'Aduan Super Admin';

    // 2. FORMAT DESKRIPSI (Tanya Jawab)
    // Format "Pertanyaan :" dan "Jawaban :" sesuai permintaan, lalu di-save ke kolom deskripsi
    const formattedDeskripsi = `Pertanyaan :\n${pesan}\n\nJawaban :\n[Menunggu balasan dari ${target === 'leader' ? 'Leader' : 'Super Admin'}]`;

    // 3. INSERT KE DATABASE qna_materi
    // Kolom created_at tidak perlu dimasukkan karena di database sudah default current_timestamp()
    const query = `
      INSERT INTO qna_materi (judul, kategori, deskripsi, file_name) 
      VALUES (?, ?, ?, ?)
    `;
    
    const values = [
      judulLaporan, 
      kategoriLaporan, 
      formattedDeskripsi, 
      fileName
    ];

    await pool.query(query, values);

    return NextResponse.json({ 
      success: true, 
      message: 'Laporan berhasil dikirim dan tersimpan di sistem.' 
    });

  } catch (error) {
    console.error('Error saat menyimpan laporan aduan:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses laporan.' },
      { status: 500 }
    );
  }
}