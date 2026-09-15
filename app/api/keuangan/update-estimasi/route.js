import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { id_pegawai, estimasi } = body;

    // Validasi data yang dikirim
    if (!id_pegawai || estimasi === undefined) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    // Tentukan periode saat ini (Format: YYYY-MM)
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodeSaatIni = `${year}-${month}`;

    // Cek apakah baris data gaji untuk bulan ini sudah ada
    const [gajiExist] = await pool.query(
      `SELECT id FROM transaksi_gaji WHERE id_pegawai = ? AND periode = ? LIMIT 1`,
      [id_pegawai, periodeSaatIni]
    );

    if (gajiExist.length > 0) {
      // Jika ada, UPDATE nilai estimasinya
      await pool.query(
        `UPDATE transaksi_gaji SET estimasi = ? WHERE id_pegawai = ? AND periode = ?`,
        [estimasi, id_pegawai, periodeSaatIni]
      );
    } else {
      // Jika ternyata belum ada (staf mengetik manual sebelum upload excel), INSERT data baru
      await pool.query(
        `INSERT INTO transaksi_gaji 
         (id_pegawai, periode, estimasi, estimasi_shared, slip_sent) 
         VALUES (?, ?, ?, 0, 0)`,
        [id_pegawai, periodeSaatIni, estimasi]
      );
    }

    return NextResponse.json({ success: true, message: 'Estimasi berhasil diperbarui' });
  } catch (error) {
    console.error("Gagal update estimasi:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}