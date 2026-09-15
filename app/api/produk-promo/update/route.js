import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const formData = await req.formData();
    
    const id = formData.get('id');
    const tipe = formData.get('tipe');
    const judul = formData.get('judul');
    const deskripsi = formData.get('deskripsi');
    const berlaku_sampai = formData.get('berlaku_sampai') || null;
    const status = formData.get('status');
    const file = formData.get('gambar_file');

    let filenameQueryPart = "";
    let queryParams = [tipe, judul, deskripsi, berlaku_sampai, status];

    // Jika user mengunggah gambar baru saat mengedit
    if (file && typeof file === 'object' && file.name) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads/super-admin/produk');
      const uploadPath = path.join(uploadDir, filename);
      
      // Pastikan folder ada
      await mkdir(uploadDir, { recursive: true });
      await writeFile(uploadPath, buffer);

      filenameQueryPart = ", gambar_file = ?";
      queryParams.push(filename);
    }

    queryParams.push(id); // Untuk klausa WHERE id = ?

    const query = `
      UPDATE produk_promo 
      SET tipe = ?, judul = ?, deskripsi = ?, berlaku_sampai = ?, status = ? ${filenameQueryPart}
      WHERE id = ?
    `;
    
    await pool.execute(query, queryParams);

    return NextResponse.json({ 
      success: true, 
      message: "Data produk/promo berhasil diperbarui!" 
    }, { status: 200 });

  } catch (error) {
    console.error("Error updating produk/promo:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server saat memperbarui data." 
    }, { status: 500 });
  }
}