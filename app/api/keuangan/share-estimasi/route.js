import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan path koneksi database Anda

export async function POST(request) {
  try {
    const body = await request.json();
    const { id_pegawai, employee_kind } = body;

    if (!Number.isSafeInteger(id_pegawai) || id_pegawai <= 0 ||
        !['fronting', 'non_fronting', 'leader'].includes(employee_kind)) {
      return NextResponse.json({ success: false, message: 'ID Pegawai tidak ditemukan' }, { status: 400 });
    }

    // 1. Tentukan periode saat ini (Format: YYYY-MM)
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodeSaatIni = `${year}-${month}`;

    // 2. Update kolom estimasi_shared menjadi 1 di tabel transaksi_gaji
    const [updateResult] = await pool.query(
      `UPDATE transaksi_gaji 
       SET estimasi_shared = 1 
       WHERE employee_kind = ? AND id_pegawai = ? AND periode = ?`,
      [employee_kind, id_pegawai, periodeSaatIni]
    );

    // Jika baris data gaji belum ada
    if (updateResult.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Data gaji bulan ini belum ada. Silakan simpan estimasi terlebih dahulu.' }, 
        { status: 404 }
      );
    }

    // ====================================================================
    // 3. INTEGRASI NOTIFIKASI KE DASHBOARD PEGAWAI
    // ====================================================================
    
    // Cari NIK pegawai karena tabel notifikasi Anda menggunakan acuan NIK
    const identityQuery = employee_kind === 'fronting'
      ? 'SELECT nik FROM master_pegawai WHERE id = ? LIMIT 1'
      : employee_kind === 'non_fronting'
        ? 'SELECT nik FROM data_non_fronting WHERE id = ? LIMIT 1'
        : 'SELECT username AS nik FROM data_leader WHERE id = ? LIMIT 1';
    const [pegawai] = await pool.query(identityQuery, [id_pegawai]);

    if (pegawai.length > 0) {
      const nikTarget = pegawai[0].nik;
      const pesanNotif = `Estimasi pendapatan Anda untuk periode ${periodeSaatIni} telah diterbitkan oleh Keuangan. Silakan cek pada bagian Perkiraan Jumlah Pendapatan di Dashboard Anda.`;

      // Insert ke tabel notifikasi (Sesuaikan nama kolom dengan struktur database Anda)
      await pool.query(
        `INSERT INTO pesan_notifikasi 
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read) 
         VALUES ('Admin Keuangan', ?, 'Pengumuman Pribadi', ?, NULL, 0)`,
        [nikTarget, pesanNotif]
      );
    }

    // ====================================================================

    return NextResponse.json({ success: true, message: 'Status berhasil diperbarui dan notifikasi terkirim' });
    
  } catch (error) {
    console.error("Gagal share estimasi:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server' }, 
      { status: 500 }
    );
  }
}
