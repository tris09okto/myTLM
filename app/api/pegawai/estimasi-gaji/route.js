import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Pastikan path ini sesuai dengan file koneksi database Anda

export async function GET(request) {
  try {
    // 1. Ambil parameter NIK dari URL frontend (contoh: ?nik=TLMTEST0018)
    const { searchParams } = new URL(request.url);
    const nik = searchParams.get('nik');

    if (!nik) {
      return NextResponse.json(
        { success: false, message: 'NIK pegawai tidak valid atau tidak ditemukan' }, 
        { status: 400 }
      );
    }

    // 2. Tentukan periode saat ini secara otomatis (Format: YYYY-MM)
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodeSaatIni = `${year}-${month}`;

    // 3. Tarik data dari database dengan menyambungkan (JOIN) kedua tabel
    const [rows] = await pool.query(`
      SELECT 
        tg.estimasi,
        tg.estimasi_shared,
        tg.slip_name,
        tg.slip_sent
      FROM transaksi_gaji tg
      JOIN master_pegawai mp ON tg.id_pegawai = mp.id
      WHERE mp.nik = ? AND tg.periode = ?
      LIMIT 1
    `, [nik, periodeSaatIni]);

    // 4. Kembalikan respons ke frontend
    if (rows.length > 0) {
      // Jika data gajinya sudah pernah dibuat oleh Keuangan (meskipun belum di-share)
      return NextResponse.json({ success: true, data: rows[0] });
    } else {
      // Jika data gajinya benar-benar kosong di bulan ini
      return NextResponse.json({ success: true, data: null });
    }

  } catch (error) {
    console.error("Gagal mengambil estimasi gaji:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem saat menghubungi database' }, 
      { status: 500 }
    );
  }
}