import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deleteFileByRef } from '@/lib/uploads';

export async function POST(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Akun tidak valid!' },
        { status: 400 }
      );
    }

    // 1. Ambil data username, pas_foto, dan surat_tugas dari master_pegawai
    const [rows] = await pool.query(
      'SELECT username, idcard_file, st_file FROM master_pegawai WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data pegawai tidak ditemukan!' },
        { status: 404 }
      );
    }

    const userData = rows[0];
    const { username, pas_foto, surat_tugas } = userData;

    // 2. Hapus berkas pas foto & surat tugas di Cloudinary / Storage Lokal
    // Menggunakan Promise.allSettled agar jika salah satu file gagal/tidak ada, proses penghapusan akun di database tetap berjalan
    await Promise.allSettled([
      deleteFileByRef(pas_foto, 'pas_foto', 'image'),
      deleteFileByRef(surat_tugas, 'surat_tugas', 'raw'), // PDF/Surat tugas umumnya tersimpan dengan resourceType 'raw'
    ]);

    // 3. Hapus data pegawai dari Database
    await pool.query('DELETE FROM master_pegawai WHERE id = ?', [id]);

    // 4. Hapus akun user terkait dari tabel users
    if (username) {
      await pool.query('DELETE FROM users WHERE username = ?', [username]);
    }

    return NextResponse.json({
      success: true,
      message: 'Akun fronting dan seluruh berkas terkait berhasil ditutup dan dihapus dari sistem.'
    });

  } catch (error) {
    console.error("Error Closing Account:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server saat menutup akun.' },
      { status: 500 }
    );
  }
}