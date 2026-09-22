import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const id = formData.get('id') as string;
    const judul = formData.get('judul') as string;
    const isi = formData.get('isi') as string;
    const status = formData.get('status') as string;
    
    // Ambil field kategori dan target penerima dari form
    const jenisPengumuman = (formData.get('jenis_pengumuman') as string) || 'PRODUK_INFORMASI';
    const targetPenerima = (formData.get('target_penerima') as string) || 'ALL';
    
    const file = formData.get('file_lampiran') as File | null;

    // Susun query dasar secara dinamis
    let query = `
      UPDATE pengumuman 
      SET judul = ?, isi = ?, status = ?, jenis_pengumuman = ?, target_penerima = ?
    `;
    let queryParams: any[] = [judul, isi, status, jenisPengumuman, targetPenerima];

    // Jika admin mengunggah file baru saat update
    if (file && typeof file === 'object' && file.name) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads/super-admin/pengumuman');
      const uploadPath = path.join(uploadDir, filename);
      
      await mkdir(uploadDir, { recursive: true });
      await writeFile(uploadPath, buffer);

      // Tambahkan update file_lampiran jika file baru disertakan
      query += `, file_lampiran = ?`;
      queryParams.push(filename);
    }

    // Tambahkan kondisi WHERE id di akhir
    query += ` WHERE id = ?`;
    queryParams.push(id);

    // Eksekusi query dengan pool.execute
    await pool.execute(query, queryParams);

    return NextResponse.json({ 
      success: true, 
      message: "Pengumuman berhasil diperbarui!" 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error updating pengumuman:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Gagal memperbarui pengumuman." 
    }, { status: 500 });
  }
}