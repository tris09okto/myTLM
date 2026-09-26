import { NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload, type StoredUpload, type UploadFolder } from '@/lib/uploads';

interface ReportRow extends RowDataPacket {
  id: number;
  nik: string;
  pesan: string | null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const senderValue = formData.get('pengirimRole');
  const recipientValue = formData.get('nikTujuan');
  const typeValue = formData.get('tipe');
  const contentValue = formData.get('konten');
  const fileValue = formData.get('file_lampiran');

  if (typeof senderValue !== 'string' || !senderValue.trim() ||
      typeof recipientValue !== 'string' || !recipientValue.trim() ||
      typeof typeValue !== 'string' || !typeValue.trim() ||
      typeof contentValue !== 'string' || !contentValue.trim() ||
      (fileValue !== null && !(fileValue instanceof File))) {
    return NextResponse.json({ success: false, message: 'Data pesan tidak valid.' }, { status: 400 });
  }

  const pengirimRole = senderValue.trim();
  const nikTujuan = recipientValue.trim();
  const tipe = typeValue.trim();
  const konten = contentValue.trim();
  const fileLampiran = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  const isDirector = pengirimRole.toLowerCase() === 'direktur';
  const isEmployeeReply = ['MO', 'HRD'].includes(nikTujuan.toUpperCase()) &&
    !['MO', 'HRD', 'DIREKTUR', 'ADMIN'].includes(pengirimRole.toUpperCase());

  let folder: UploadFolder = 'admin';
  let prefix = 'lampiran_';
  if (isDirector) {
    folder = 'direktur';
    prefix = 'instruksi_';
  } else if (isEmployeeReply) {
    folder = 'balasan_pegawai';
    prefix = 'balasan_pegawai_';
  }

  const isReportReply = (pengirimRole.toUpperCase() === 'MO' || pengirimRole.toLowerCase() === 'supervisor') &&
    (tipe.toLowerCase().includes('laporan') || tipe.toLowerCase().includes('aduan') || tipe.toLowerCase().includes('balasan'));
  const broadcastFlags = ['ALL', 'ALL_FRONTING', 'ALL_NON_FRONTING', 'HRD', 'MO', 'DIREKTUR', 'KEUANGAN'];

  let report: ReportRow | undefined;
  if (isReportReply && !broadcastFlags.includes(nikTujuan.toUpperCase())) {
    const [reports] = await pool.query<ReportRow[]>(
      `SELECT id, nik, pesan FROM laporan_aduan
       WHERE nik = ? OR id = ? ORDER BY created_at DESC LIMIT 1`,
      [nikTujuan, nikTujuan],
    );
    report = reports[0];
  }

  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    let fileReference: string | null = null;
    if (fileLampiran) {
      const originalFileName = fileLampiran.name.replace(/\s+/g, '_');
      upload = await storeFileUpload({
        file: fileLampiran,
        folder,
        localFileName: `${prefix}${Date.now()}_${originalFileName}`,
      });
      fileReference = upload.reference;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    let targetNik = nikTujuan;

    if (report) {
      targetNik = report.nik;
      const currentMessage = report.pesan ?? '';
      const updatedMessage = currentMessage.includes('\n\nJawaban :\n')
        ? `${currentMessage.split('\n\nJawaban :\n')[0]}\n\nJawaban :\n${konten}`
        : `${currentMessage}\n\nJawaban :\n${konten}`;
      await connection.query('UPDATE laporan_aduan SET pesan = ? WHERE id = ?', [updatedMessage, report.id]);
    }

    if (isDirector && nikTujuan === 'ALL') {
      for (const division of ['MO', 'HRD', 'Keuangan']) {
        await connection.query(
          `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
           VALUES (?, ?, ?, ?, ?, 0)`,
          [pengirimRole, division, tipe, konten, fileReference],
        );
      }
    } else {
      await connection.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [pengirimRole, targetNik || 'ALL', tipe, konten, fileReference],
      );
    }

    await connection.commit();
    committed = true;
    return NextResponse.json({ success: true, message: 'Pesan/Balasan berhasil dikirim.' });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error('Gagal membatalkan transaksi pesan:', rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error('Gagal kirim pesan:', error);
    return NextResponse.json({ success: false, message: 'Kesalahan internal server' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
