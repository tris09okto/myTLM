import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin' || session.user.jabatan?.toLowerCase() !== 'direktur') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const form = await request.formData();
  const id = Number(form.get('id'));
  const answer = form.get('tanggapan');
  const file = form.get('file_sanggahan');
  if (!Number.isSafeInteger(id) || id <= 0 || typeof answer !== 'string' || !answer.trim() ||
      answer.length > 10000 || (file !== null && (!(file instanceof File) || file.size > 10_000_000))) {
    return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
  }

  try {
    const [reports] = await pool.query(
      `SELECT pengirim_role FROM pesan_notifikasi
       WHERE id = ? AND penerima_nik = 'DIREKTUR' LIMIT 1`, [id]
    );
    if (!reports[0]) return NextResponse.json({ success: false, message: 'Laporan tidak ditemukan' }, { status: 404 });
    let fileName = null;
    if (file instanceof File && file.size > 0) {
      fileName = `${randomUUID()}${path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12)}`;
      const folder = path.join(process.cwd(), 'public', 'uploads', 'laporan-direktur');
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, fileName), Buffer.from(await file.arrayBuffer()));
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
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ success: true, message: 'Tanggapan berhasil dikirim' });
  } catch {
    return NextResponse.json({ success: false, message: 'Gagal mengirim tanggapan' }, { status: 500 });
  }
}
