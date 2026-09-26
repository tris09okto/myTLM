import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

// Konfigurasi Cloudinary (Otomatis mengambil dari environment variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const idPegawai = formData.get('id_pegawai');
    const employeeKind = formData.get('employee_kind');

    if (!(file instanceof File) || file.type !== 'application/pdf' || file.size > 10_000_000 ||
        !Number.isSafeInteger(Number(idPegawai)) || Number(idPegawai) <= 0 ||
        !['fronting', 'non_fronting', 'leader'].includes(employeeKind)) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    // 1. Tentukan Periode Saat Ini
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const periodeSaatIni = `${year}-${month}`;

    // 2. Modifikasi Nama File (Agar tidak bentrok jika namanya sama)
    // Format: IDPegawai_Periode_NamaAsli.pdf
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFileName = `${employeeKind}_${idPegawai}_${periodeSaatIni}_${originalName}`;

    // Ekstrak buffer file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let finalDbName = safeFileName;

    if (process.env.NODE_ENV === 'production') {
      // ==========================================
      // MODE PRODUCTION: UPLOAD KE CLOUDINARY
      // ==========================================
      const targetFolder = 'uploads/slips';

      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: targetFolder,
            resource_type: 'raw',   // Gunakan 'raw' karena ini file PDF
            public_id: safeFileName // Sertakan ekstensi .pdf di public_id untuk tipe raw
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary Upload Error:", error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(buffer);
      });

      // Simpan URL penuh Cloudinary ke database
      finalDbName = uploadResult.secure_url;

    } else {
      // ==========================================
      // MODE DEVELOPMENT: UPLOAD KE FOLDER LOKAL
      // ==========================================
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'slips');
      await fs.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, safeFileName);
      await fs.writeFile(filePath, buffer);
    }

    // 3. Update Database transaksi_gaji
    // Ubah slip_name dengan nama file/URL baru dan ubah slip_sent menjadi 1 (Sudah dikirim)
    const [result] = await pool.query(
      `UPDATE transaksi_gaji 
       SET slip_name = ?, slip_sent = 1 
       WHERE employee_kind = ? AND id_pegawai = ? AND periode = ?`,
      [finalDbName, employeeKind, idPegawai, periodeSaatIni]
    );

    if (result.affectedRows === 0) {
      // Jika baris tidak ditemukan (estimasi belum dibuat), buatkan baris baru
      await pool.query(
        `INSERT INTO transaksi_gaji 
         (id_pegawai, employee_kind, periode, estimasi, estimasi_shared, slip_name, slip_sent) 
         VALUES (?, ?, ?, 0, 0, ?, 1)`,
        [idPegawai, employeeKind, periodeSaatIni, finalDbName]
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Slip gaji berhasil diunggah dan dikirim',
      fileName: finalDbName
    });

  } catch (error) {
    console.error("Gagal upload slip:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}