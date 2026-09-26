import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Sesuaikan path import database Anda
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function POST(req: Request) {
  let upload;
  let committed = false;
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

    if (foto instanceof File && foto.size > 0) {
      const extension = foto.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      upload = await storeFileUpload({
        file: foto,
        folder: 'qna',
        localFileName: `laporan-${nik}-${Date.now()}.${extension}`,
      });
      fileName = upload.reference;
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
    committed = true;

    return NextResponse.json({ 
      success: true, 
      message: 'Laporan berhasil dikirim dan tersimpan di sistem.' 
    });

  } catch (error) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error('Error saat menyimpan laporan aduan:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server saat memproses laporan.' },
      { status: 500 }
    );
  }
}
