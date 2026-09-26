import { NextResponse } from 'next/server';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from '@/lib/uploads';

interface SupervisorRow extends RowDataPacket { supervisor: string | null }
interface UsernameRow extends RowDataPacket { username: string }

export async function POST(request: Request) {
  const formData = await request.formData();
  const targetValue = formData.get('target');
  const target = typeof targetValue === 'string' ? targetValue : 'admin_mo_spv';
  const pesan = formData.get('pesan');
  const nik = formData.get('nik');
  const nama = formData.get('nama');
  const foto = formData.get('foto');

  if (typeof pesan !== 'string' || !pesan.trim() || typeof nik !== 'string' || !nik.trim() ||
      (foto !== null && (!(foto instanceof File) || foto.size > 10_000_000))) {
    return NextResponse.json(
      { success: false, message: 'Pesan laporan dan NIK tidak boleh kosong.' },
      { status: 400 },
    );
  }

  let upload: StoredUpload | undefined;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    const [employeeRows] = await pool.query<SupervisorRow[]>(
      'SELECT supervisor FROM data_non_fronting WHERE nik = ? LIMIT 1', [nik],
    );
    const supervisorName = employeeRows[0]?.supervisor;
    let supervisorUsername: string | undefined;
    if (supervisorName) {
      const [users] = await pool.query<UsernameRow[]>(
        'SELECT username FROM data_non_fronting WHERE nama = ? OR username = ? LIMIT 1',
        [supervisorName, supervisorName],
      );
      supervisorUsername = users[0]?.username;
    }

    let moUsernames: string[] = [];
    if (target === 'admin_mo_spv') {
      const [targetUsers] = await pool.query<UsernameRow[]>(
        "SELECT username FROM users WHERE LOWER(jabatan) LIKE '%mo%'",
      );
      moUsernames = targetUsers.map((user) => user.username);
    }

    let fileName: string | null = null;
    if (foto instanceof File && foto.size > 0) {
      const safeOriginalName = foto.name.replace(/\s+/g, '_');
      upload = await storeFileUpload({
        file: foto,
        folder: 'non-fronting',
        localFileName: `laporan_${nik}_${Date.now()}_${safeOriginalName}`,
        resourceType: 'image',
      });
      fileName = upload.reference;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    await connection.query(
      `INSERT INTO laporan_aduan (nik, nama, target, pesan, foto, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [nik, nama, target, pesan.trim(), fileName],
    );

    if (supervisorUsername) {
      await connection.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, ?, 'Laporan Pegawai', ?, ?, 0, NOW())`,
        [nik, supervisorUsername, `[Laporan Pegawai] Dari: ${nama} (${nik}). Pesan: "${pesan.trim()}"`, fileName],
      );
    }

    if (target === 'admin_mo_spv' && moUsernames.includes('adminmo')) {
      await connection.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, 'MO', 'Laporan Pegawai', ?, ?, 0, NOW())`,
        [nik, `[Laporan Baru] Dari Pegawai: ${nama} (${nik}). Pesan: "${pesan.trim()}"`, fileName],
      );
    }

    await connection.commit();
    committed = true;
    return NextResponse.json({
      success: true,
      message: 'Laporan berhasil dikirim dan notifikasi telah diteruskan ke Supervisor & Admin MO.',
    }, { status: 200 });
  } catch (error) {
    if (connection && transactionStarted && !committed) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Gagal membatalkan transaksi laporan:', rollbackError); }
    }
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error('Database/Server Error pada /api/pegawai/laporan-aduan-non-fronting:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan internal pada server.' },
      { status: 500 },
    );
  } finally {
    connection?.release();
  }
}
