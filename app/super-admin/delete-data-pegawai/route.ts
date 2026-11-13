import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { deleteFileByRef } from '@/lib/uploads';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.id) {
      return NextResponse.json(
        { success: false, message: 'Payload atau ID Akun tidak valid!' },
        { status: 400 }
      );
    }

    const { id } = body;

    // 1. Ambil berkas & username dari tabel data_non_fronting
    const [rows]: any = await pool.query(
      'SELECT username, pas_foto, surat_tugas FROM data_non_fronting WHERE id = ?',
      [id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data pegawai non-fronting tidak ditemukan!' },
        { status: 404 }
      );
    }

    const userData = rows[0];
    const { username, pas_foto, surat_tugas } = userData;

    // 2. Hapus pas_foto & surat_tugas di Cloudinary / Storage Lokal
    await Promise.allSettled([
      deleteFileByRef(pas_foto, 'non-fronting/pas_foto', 'image'),
      deleteFileByRef(surat_tugas, 'non-fronting/surat_tugas', 'raw'),
    ]);

    // 3. Hapus data pegawai dari database
    await pool.query('DELETE FROM data_non_fronting WHERE id = ?', [id]);

    // 4. Hapus akun login dari tabel users
    if (username) {
      await pool.query('DELETE FROM users WHERE username = ?', [username]);
    }

    return NextResponse.json({
      success: true,
      message: 'Akun pegawai non-fronting beserta seluruh berkas berhasil dihapus.',
    });

  } catch (error: any) {
    console.error("Error Deleting Non-Fronting Pegawai:", error);
    return NextResponse.json(
      { success: false, message: `Terjadi kesalahan server: ${error.message || 'Server Error'}` },
      { status: 500 }
    );
  }
}