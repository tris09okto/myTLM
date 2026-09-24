import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin' || session.user.jabatan?.toLowerCase() !== 'direktur') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.pengirim_role, p.tipe_pesan, p.konten, p.file_lampiran,
             p.created_at, p.is_read,
             (SELECT r.konten FROM pesan_notifikasi r
              WHERE r.tipe_pesan = CONCAT('Balasan Direktur #', p.id)
              ORDER BY r.id DESC LIMIT 1) AS tanggapan_direktur,
             (SELECT r.file_lampiran FROM pesan_notifikasi r
              WHERE r.tipe_pesan = CONCAT('Balasan Direktur #', p.id)
              ORDER BY r.id DESC LIMIT 1) AS file_sanggahan
      FROM pesan_notifikasi p
      WHERE p.penerima_nik = 'DIREKTUR' OR p.tipe_pesan LIKE '%Laporan ke Direktur%'
      ORDER BY p.created_at DESC
    `);
    return NextResponse.json({ success: true, data: rows });
  } catch {
    return NextResponse.json({ success: false, message: 'Gagal memuat laporan Direktur' }, { status: 500 });
  }
}
