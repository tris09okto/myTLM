import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const id = formData.get('id');
    const tanggapan = formData.get('tanggapan');
    const fileSanggahan = formData.get('file_sanggahan');

    if (!id || !tanggapan) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    let safeFileName = null;

    // Jika Direktur mengunggah file sanggahan/balasan
    if (fileSanggahan && typeof fileSanggahan === 'object') {
      const uploadDir = path.join(process.cwd(), 'public/uploads/laporan-direktur');
      await fs.mkdir(uploadDir, { recursive: true });

      safeFileName = `sanggahan_${Date.now()}_${fileSanggahan.name.replace(/\s+/g, '_')}`;
      const filePath = path.join(uploadDir, safeFileName);

      const bytes = await fileSanggahan.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(filePath, buffer);
    }

    // Update data tanggapan di database
    if (safeFileName) {
      await pool.query(
        `UPDATE notifikasi SET tanggapan_direktur = ?, file_sanggahan = ?, is_read = 1 WHERE id = ?`,
        [tanggapan, safeFileName, id]
      );
    } else {
      await pool.query(
        `UPDATE notifikasi SET tanggapan_direktur = ?, is_read = 1 WHERE id = ?`,
        [tanggapan, id]
      );
    }

    return NextResponse.json({ success: true, message: 'Tanggapan berhasil disimpan' });

  } catch (error) {
    console.error("Gagal menyimpan tanggapan direktur:", error);
    return NextResponse.json({ success: false, message: 'Kesalahan internal server' }, { status: 500 });
  }
}