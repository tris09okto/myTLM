import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function POST(req) {
  let upload;
  let committed = false;
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
    if (file instanceof File && file.name) {
      upload = await storeFileUpload({
        file,
        folder: 'super-admin/produk',
        localFileName: `${Date.now()}-${file.name.replace(/\s+/g, '_')}`,
      });

      filenameQueryPart = ", gambar_file = ?";
      queryParams.push(upload.reference);
    }

    queryParams.push(id); // Untuk klausa WHERE id = ?

    const query = `
      UPDATE produk_promo 
      SET tipe = ?, judul = ?, deskripsi = ?, berlaku_sampai = ?, status = ? ${filenameQueryPart}
      WHERE id = ?
    `;
    
    await pool.execute(query, queryParams);
    committed = true;

    return NextResponse.json({ 
      success: true, 
      message: "Data produk/promo berhasil diperbarui!" 
    }, { status: 200 });

  } catch (error) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error("Error updating produk/promo:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server saat memperbarui data." 
    }, { status: 500 });
  }
}
