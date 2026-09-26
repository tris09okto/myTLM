import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';

export async function POST(request) {
  let upload;
  let connection;
  let transactionStarted = false;
  let committed = false;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const idPegawai = formData.get('id_pegawai');
    const employeeKind = formData.get('employee_kind');

    if (!(file instanceof File) || file.type !== 'application/pdf' || file.size === 0 || file.size > 10_000_000 ||
        !Number.isSafeInteger(Number(idPegawai)) || Number(idPegawai) <= 0 ||
        !['fronting', 'non_fronting', 'leader'].includes(employeeKind)) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    const id = Number(idPegawai);
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localFileName = `${employeeKind}_${id}_${period}_${originalName}`;
    upload = await storeFileUpload({
      file,
      folder: 'slips',
      localFileName,
      resourceType: 'raw',
    });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [result] = await connection.query(
      `UPDATE transaksi_gaji SET slip_name = ?, slip_sent = 1
       WHERE employee_kind = ? AND id_pegawai = ? AND periode = ?`,
      [upload.reference, employeeKind, id, period],
    );

    if (result.affectedRows === 0) {
      await connection.query(
        `INSERT INTO transaksi_gaji
         (id_pegawai, employee_kind, periode, estimasi, estimasi_shared, slip_name, slip_sent)
         VALUES (?, ?, ?, 0, 0, ?, 1)`,
        [id, employeeKind, period, upload.reference],
      );
    }
    await connection.commit();
    committed = true;

    return NextResponse.json({
      success: true,
      message: 'Slip gaji berhasil diunggah dan dikirim',
      fileName: upload.reference,
    });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error('Gagal membatalkan transaksi slip gaji:', rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error('Gagal upload slip:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
