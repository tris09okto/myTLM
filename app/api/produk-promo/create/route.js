import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Ambil semua data produk & promo dari database, urutkan dari yang terbaru
    const [rows] = await pool.execute('SELECT * FROM produk_promo ORDER BY created_at DESC');
    
    return NextResponse.json({ 
      success: true, 
      data: rows 
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching produk/promo:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Gagal mengambil data dari database." 
    }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    
    const tipe = formData.get('tipe');
    const judul = formData.get('judul');
    const deskripsi = formData.get('deskripsi');
    const berlaku_sampai = formData.get('berlaku_sampai') || null;
    const status = formData.get('status');
    const file = formData.get('gambar_file');

    let filename = null;

    // Proses simpan file gambar jika diunggah
    if (file && typeof file === 'object' && file.name) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Buat nama unik untuk file
      filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      
      const uploadDir = path.join(process.cwd(), 'public/uploads/super-admin/produk');
      const uploadPath = path.join(uploadDir, filename);
      
      // 1. Pastikan folder tujuan ada (buat otomatis jika belum ada)
      await mkdir(uploadDir, { recursive: true });
      
      // 2. Simpan file
      await writeFile(uploadPath, buffer);
    }
      
    const query = `
      INSERT INTO produk_promo (tipe, judul, deskripsi, gambar_file, berlaku_sampai, status) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(query, [tipe, judul, deskripsi, filename, berlaku_sampai, status]);

    return NextResponse.json({ 
      success: true, 
      message: "Data produk/promo berhasil disimpan ke database!" 
    }, { status: 200 });

  } catch (error) {
    console.error("Error saving produk/promo:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server saat menyimpan data." 
    }, { status: 500 });
  }
}