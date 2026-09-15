import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const id = formData.get('id');
    const judul = formData.get('judul');
    const isi = formData.get('isi');
    const status = formData.get('status');
    const file = formData.get('file_lampiran');

    let fileQueryPart = "";
    let queryParams = [judul, isi, status];

    if (file && typeof file === 'object' && file.name) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public/uploads/super-admin/pengumuman');
      const uploadPath = path.join(uploadDir, filename);
      
      await mkdir(uploadDir, { recursive: true });
      await writeFile(uploadPath, buffer);

      fileQueryPart = ", file_lampiran = ?";
      queryParams.push(filename);
    }

    queryParams.push(id);

    const query = `
      UPDATE pengumuman 
      SET judul = ?, isi = ?, status = ? ${fileQueryPart}
      WHERE id = ?
    `;
    await pool.execute(query, queryParams);

    return NextResponse.json({ success: true, message: "Pengumuman berhasil diperbarui!" }, { status: 200 });
  } catch (error) {
    console.error("Error updating pengumuman:", error);
    return NextResponse.json({ success: false, message: "Gagal memperbarui pengumuman." }, { status: 500 });
  }
}