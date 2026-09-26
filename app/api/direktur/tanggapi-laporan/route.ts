import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from '@/lib/uploads';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin' || session.user.jabatan?.toLowerCase() !== 'direktur') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const id = Number(form.get('id'));
  const answer = form.get('tanggapan') as string;
  const file = form.get('file_sanggahan');

  if (!Number.isSafeInteger(id) || id <= 0 || typeof answer !== 'string' || !answer.trim() ||
      answer.length > 10000 || (file !== null && (!(file instanceof File) || file.size > 10_000_000))) {
    return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
  }

  let upload: StoredUpload | undefined;
  let committed = false;
  try {
    const [reports]: any = await pool.query(
      `SELECT pengirim_role FROM pesan_notifikasi
       WHERE id = ? AND penerima_nik = 'DIREKTUR' LIMIT 1`, [id]
    );

    if (!reports[0]) return NextResponse.json({ success: false, message: 'Laporan tidak ditemukan' }, { status: 404 });

    let fileName: string | null = null;

    if (file instanceof File && file.size > 0) {
      const originalExt = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
      const generatedUUID = randomUUID();
      upload = await storeFileUpload({
        file,
        folder: 'laporan-direktur',
        localFileName: `${generatedUUID}${originalExt}`,
      });
      fileName = upload.reference;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES ('Direktur', ?, ?, ?, ?, 0)`,
        [reports[0].pengirim_role, `Balasan Direktur #${id}`, answer.trim(), fileName]
      );
      await connection.query('UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ?', [id]);
      await connection.commit();
      committed = true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ success: true, message: 'Tanggapan berhasil dikirim' });
  } catch (error) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error("Gagal mengirim tanggapan:", error);
    return NextResponse.json({ success: false, message: 'Gagal mengirim tanggapan' }, { status: 500 });
  }
}
