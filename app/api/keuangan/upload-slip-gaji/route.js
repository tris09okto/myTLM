import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const idPegawai = formData.get('id_pegawai');

    if (!file || !idPegawai) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    // 1. Tentukan Periode Saat Ini
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodeSaatIni = `${year}-${month}`;

    // 2. Persiapkan Folder Penyimpanan (di folder public/uploads/slips)
    const uploadDir = path.join(process.cwd(), 'public/uploads/slips');
    await fs.mkdir(uploadDir, { recursive: true }); // Otomatis membuat folder jika belum ada

    // 3. Modifikasi Nama File (Agar tidak bentrok jika namanya sama)
    // Format: IDPegawai_Periode_NamaAsli.pdf
    const safeFileName = `${idPegawai}_${periodeSaatIni}_${file.name.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadDir, safeFileName);

    // 4. Tulis File ke Server
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // 5. Update Database transaksi_gaji
    // Ubah slip_name dengan nama file baru dan ubah slip_sent menjadi 1 (Sudah dikirim)
    const [result] = await pool.query(
      `UPDATE transaksi_gaji 
       SET slip_name = ?, slip_sent = 1 
       WHERE id_pegawai = ? AND periode = ?`,
      [safeFileName, idPegawai, periodeSaatIni]
    );

    if (result.affectedRows === 0) {
      // Jika baris tidak ditemukan (estimasi belum dibuat), buatkan baris baru
      await pool.query(
        `INSERT INTO transaksi_gaji 
         (id_pegawai, periode, estimasi, estimasi_shared, slip_name, slip_sent) 
         VALUES (?, ?, 0, 0, ?, 1)`,
        [idPegawai, periodeSaatIni, safeFileName]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Slip gaji berhasil diunggah dan dikirim',
      fileName: safeFileName
    });

  } catch (error) {
    console.error("Gagal upload slip:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}