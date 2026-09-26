import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { resolveUploadUrl } from '@/lib/mobile/attachment-path';
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function GET() {
  try {
    // Ambil semua data produk & promo dari database, urutkan dari yang terbaru
    const [rows] = await pool.execute('SELECT * FROM produk_promo ORDER BY created_at DESC');
    
    const data = await Promise.all(rows.map(async (product) => ({
      ...product,
      gambar_file_url: await resolveUploadUrl(product.gambar_file, "super-admin/produk"),
    })));
    return NextResponse.json({ 
      success: true, 
      data,
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
  let upload;
  let committed = false;
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
    if (file instanceof File && file.name) {
      upload = await storeFileUpload({
        file,
        folder: 'super-admin/produk',
        localFileName: `${Date.now()}-${file.name.replace(/\s+/g, '_')}`,
      });
      filename = upload.reference;
    }
      
    const query = `
      INSERT INTO produk_promo (tipe, judul, deskripsi, gambar_file, berlaku_sampai, status) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(query, [tipe, judul, deskripsi, filename, berlaku_sampai, status]);
    committed = true;

    return NextResponse.json({ 
      success: true, 
      message: "Data produk/promo berhasil disimpan ke database!" 
    }, { status: 200 });

  } catch (error) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error("Error saving produk/promo:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server saat menyimpan data." 
    }, { status: 500 });
  }
}
