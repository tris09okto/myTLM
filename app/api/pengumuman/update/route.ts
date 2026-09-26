import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function POST(req: Request) {
  let upload;
  let committed = false;
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
    if (file instanceof File && file.name && file.size > 0) {
      upload = await storeFileUpload({
        file,
        folder: 'super-admin/pengumuman',
        localFileName: `${Date.now()}-${file.name.replace(/\s+/g, '_')}`,
      });
      // Tambahkan update file_lampiran jika file baru disertakan
      query += `, file_lampiran = ?`;
      queryParams.push(upload.reference);
    }

    // Tambahkan kondisi WHERE id di akhir
    query += ` WHERE id = ?`;
    queryParams.push(id);

    // Eksekusi query dengan pool.execute
    await pool.execute(query, queryParams);
    committed = true;

    return NextResponse.json({ 
      success: true, 
      message: "Pengumuman berhasil diperbarui!" 
    }, { status: 200 });

  } catch (error: any) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error("Error updating pengumuman:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Gagal memperbarui pengumuman." 
    }, { status: 500 });
  }
}
