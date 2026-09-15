import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.execute('SELECT * FROM pengumuman ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data: rows }, { status: 200 });
  } catch (error) {
    console.error("Error fetching pengumuman:", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const judul = formData.get('judul');
    const isi = formData.get('isi');
    const status = formData.get('status');
    const file = formData.get('file_lampiran');

    let filename = null;
    if (file && typeof file === 'object' && file.name) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads/super-admin/pengumuman');
      const uploadPath = path.join(uploadDir, filename);
      
      await mkdir(uploadDir, { recursive: true });
      await writeFile(uploadPath, buffer);
    }

    // 1. Simpan pengumuman ke tabel utama
    const queryPengumuman = `
      INSERT INTO pengumuman (judul, isi, file_lampiran, status) 
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.execute(queryPengumuman, [judul, isi, filename, status]);

    // 2. Jika status AKTIF, otomatis buat notifikasi untuk pegawai fronting
    if (status === 'AKTIF') {
      const kontenNotifikasi = `[${judul}]\n\n${isi}`;
      
      const queryNotifikasi = `
        INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await pool.execute(queryNotifikasi, [
        'superadmin',      // pengirim_role
        'ALL_FRONTING',     // penerima_nik (sesuai logika router fronting untuk broadcast)
        'Pengumuman Umum',  // tipe_pesan
        kontenNotifikasi,   // konten
        filename,           // file_lampiran (jika ada)
        0                   // is_read (0 = belum dibaca)
      ]);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Pengumuman berhasil dibuat dan notifikasi telah dikirim ke pegawai fronting!" 
    }, { status: 200 });

  } catch (error) {
    console.error("Error creating pengumuman & notification:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Gagal menyimpan pengumuman dan mengirim notifikasi." 
    }, { status: 500 });
  }
}