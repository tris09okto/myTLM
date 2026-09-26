import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db';
import { resolveUploadUrl } from '@/lib/mobile/attachment-path';
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target'); 

    let query = 'SELECT * FROM pengumuman WHERE status = "AKTIF"';
    const queryParams: any[] = [];

    // Logika penyaringan tingkat database
    if (target === 'ALL_FRONTING') {
      query += ' AND (target_penerima = "ALL" OR target_penerima = "ALL_FRONTING")';
    } else if (target === 'ALL_NON_FRONTING') {
      query += ' AND (target_penerima = "ALL" OR target_penerima = "ALL_NON_FRONTING")';
    } 

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute<RowDataPacket[]>(query, queryParams);

    return NextResponse.json({
      success: true,
      data: await Promise.all(rows.map(async (announcement) => ({
        ...announcement,
        file_lampiran_url: await resolveUploadUrl(announcement.file_lampiran, "super-admin/pengumuman"),
      }))),
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching pengumuman:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal mengambil data." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let upload;
  let connection;
  let transactionStarted = false;
  let committed = false;
  try {
    const formData = await req.formData();
    const judul = formData.get('judul') as string;
    const isi = formData.get('isi') as string;
    const status = formData.get('status') as string;
    
    // Explicit type casting untuk mencegah error tipe data
    const jenisPengumuman = (formData.get('jenis_pengumuman') as string) || 'PRODUK_INFORMASI';
    const targetPenerima = (formData.get('target_penerima') as string) || 'ALL';
    const file = formData.get('file_lampiran') as File | null;

    let filename = null;
    if (file instanceof File && file.name && file.size > 0) {
      upload = await storeFileUpload({
        file,
        folder: 'super-admin/pengumuman',
        localFileName: `${Date.now()}-${file.name.replace(/\s+/g, '_')}`,
      });
      filename = upload.reference;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Simpan pengumuman ke tabel utama
    const queryPengumuman = `
      INSERT INTO pengumuman (judul, isi, file_lampiran, status, jenis_pengumuman, target_penerima) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await connection.execute(queryPengumuman, [
      judul, 
      isi, 
      filename, 
      status, 
      jenisPengumuman, 
      targetPenerima
    ]);

    // 2. Buat notifikasi lonceng dinamis berdasarkan target
    if (status === 'AKTIF') {
      const kontenNotifikasi = `[${judul}]\n\n${isi}`;
      
      const queryNotifikasi = `
        INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      let tipe_pesan = 'Pengumuman Umum';
      const upperJenis = jenisPengumuman.toUpperCase();

      if (upperJenis.includes('UMUM')) {
          tipe_pesan = 'Pengumuman Umum';
      } else if (upperJenis.includes('PRODUK_INFORMASI')) {
          tipe_pesan = 'Pengumuman Produk / Informasi';
      } else {
          tipe_pesan = 'Pengumuman Pribadi';
      }

      await connection.execute(queryNotifikasi, [
        'super admin',      // pengirim_role
        targetPenerima,     // penerima_nik (menyimpan target broadcast seperti ALL_FRONTING)
        tipe_pesan,         // tipe_pesan
        kontenNotifikasi,   // konten
        filename,           // file_lampiran 
        0                   // is_read (0 = belum dibaca)
      ]);
    }
    await connection.commit();
    committed = true;

    return NextResponse.json({ 
      success: true, 
      message: "Pengumuman berhasil dibuat & notifikasi telah dikirim!" 
    }, { status: 200 });

  } catch (error: any) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error('Gagal membatalkan transaksi pengumuman:', rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error("Error creating pengumuman & notification:", error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Gagal menyimpan pengumuman." 
    }, { status: 500 });
  } finally {
    connection?.release();
  }
}
