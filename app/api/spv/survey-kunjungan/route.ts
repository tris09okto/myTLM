import { NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from '@/lib/uploads';

interface RecipientRow extends RowDataPacket { jabatan: string }

export async function POST(request: Request) {
  const formData = await request.formData();
  const keterangan = formData.get('keterangan');
  const spvUsername = formData.get('spv_username');
  const spvNama = formData.get('spv_nama');
  const foto = formData.get('foto');

  if (typeof keterangan !== 'string' || !keterangan.trim() ||
      typeof spvUsername !== 'string' || !spvUsername.trim() ||
      (foto !== null && (!(foto instanceof File) || foto.size > 10_000_000))) {
    return NextResponse.json(
      { success: false, message: 'Keterangan survey dan username SPV tidak boleh kosong.' },
      { status: 400 },
    );
  }

  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    const [targetUsers] = await pool.query<RecipientRow[]>(
      `SELECT jabatan FROM users
       WHERE LOWER(jabatan) LIKE '%mo%' OR LOWER(jabatan) LIKE '%hrd%'`,
    );
    let fileName: string | null = null;
    if (foto instanceof File && foto.size > 0) {
      const safeOriginalName = foto.name.replace(/\s+/g, '_');
      upload = await storeFileUpload({
        file: foto,
        folder: 'spv-survey-kunjungan',
        localFileName: `survey_${spvUsername}_${Date.now()}_${safeOriginalName}`,
        resourceType: 'image',
      });
      fileName = upload.reference;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    await connection.query(
      `INSERT INTO survey_kunjungan (spv_username, spv_nama, keterangan, foto, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [spvUsername, spvNama, keterangan.trim(), fileName],
    );

    const notificationContent = `[Survey Kunjungan] Dari SPV: ${spvNama} (${spvUsername}). Keterangan: "${keterangan.trim()}"`;
    for (const recipient of targetUsers) {
      await connection.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, ?, 'Survey Kunjungan Lapangan', ?, ?, 0, NOW())`,
        [spvUsername, recipient.jabatan, notificationContent, fileName],
      );
    }

    await connection.commit();
    committed = true;
    return NextResponse.json({
      success: true,
      message: 'Survey kunjungan berhasil dikirim dan notifikasi telah diteruskan ke Admin MO dan HRD.',
    }, { status: 200 });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error('Gagal membatalkan transaksi survey:', rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error('Database/Server Error pada /api/spv/survey-kunjungan:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan internal pada server.' },
      { status: 500 },
    );
  } finally {
    connection?.release();
  }
}
