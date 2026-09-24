import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { id_pegawai, employee_kind, estimasi } = body;

    // Validasi data yang dikirim
    if (!Number.isSafeInteger(id_pegawai) || id_pegawai <= 0 ||
        !['fronting', 'non_fronting', 'leader'].includes(employee_kind) ||
        typeof estimasi !== 'number' || !Number.isFinite(estimasi) || estimasi < 0) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    // Tentukan periode saat ini (Format: YYYY-MM)
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodeSaatIni = `${year}-${month}`;

    // Cek apakah baris data gaji untuk bulan ini sudah ada
    const [gajiExist] = await pool.query(
      `SELECT id FROM transaksi_gaji WHERE employee_kind = ? AND id_pegawai = ? AND periode = ? LIMIT 1`,
      [employee_kind, id_pegawai, periodeSaatIni]
    );

    if (gajiExist.length > 0) {
      // Jika ada, UPDATE nilai estimasinya
      await pool.query(
        `UPDATE transaksi_gaji SET estimasi = ? WHERE employee_kind = ? AND id_pegawai = ? AND periode = ?`,
        [estimasi, employee_kind, id_pegawai, periodeSaatIni]
      );
    } else {
      // Jika ternyata belum ada (staf mengetik manual sebelum upload excel), INSERT data baru
      await pool.query(
        `INSERT INTO transaksi_gaji 
         (id_pegawai, employee_kind, periode, estimasi, estimasi_shared, slip_sent) 
         VALUES (?, ?, ?, ?, 0, 0)`,
        [id_pegawai, employee_kind, periodeSaatIni, estimasi]
      );
    }

    return NextResponse.json({ success: true, message: 'Estimasi berhasil diperbarui' });
  } catch (error) {
    console.error("Gagal update estimasi:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
