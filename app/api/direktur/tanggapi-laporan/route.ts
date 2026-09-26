import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { v2 as cloudinary } from 'cloudinary';

import { authOptions } from '@/lib/auth';
import { pool } from '@/lib/db';

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin' || session.user.jabatan?.toLowerCase() !== 'direktur') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const id = Number(form.get('id'));
  const answer = form.get('tanggapan') as string;
  const file = form.get('file_sanggahan');

  if (!Number.isSafeInteger(id) || id <= 0 || typeof answer !== 'string' || !answer.trim() ||
      answer.length > 10000 || (file !== null && (!(file instanceof File) || file.size > 10_000_000))) {
    return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
  }

  try {
    const [reports]: any = await pool.query(
      `SELECT pengirim_role FROM pesan_notifikasi
       WHERE id = ? AND penerima_nik = 'DIREKTUR' LIMIT 1`, [id]
    );

    if (!reports[0]) return NextResponse.json({ success: false, message: 'Laporan tidak ditemukan' }, { status: 404 });

    let fileName: string | null = null;

    if (file instanceof File && file.size > 0) {
      const originalExt = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12);
      const generatedUUID = randomUUID();
      const targetFolder = 'uploads/laporan-direktur';
      
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (process.env.NODE_ENV === 'production') {
        const fileType = file.type || ''; 
        const isImage = fileType.startsWith('image/');
        const resourceType = isImage ? 'image' : 'raw';

        const publicId = isImage ? generatedUUID : `${generatedUUID}${originalExt}`;

        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { 
              folder: targetFolder, 
              resource_type: resourceType,
              public_id: publicId
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

        fileName = (uploadResult as any).secure_url;
      } else {
        fileName = `${generatedUUID}${originalExt}`;
        const localFolder = path.join(process.cwd(), 'public', targetFolder);
        await mkdir(localFolder, { recursive: true });
        await writeFile(path.join(localFolder, fileName), buffer);
      }
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES ('Direktur', ?, ?, ?, ?, 0)`,
        [reports[0].pengirim_role, `Balasan Direktur #${id}`, answer.trim(), fileName]
      );
      await connection.query('UPDATE pesan_notifikasi SET is_read = 1 WHERE id = ?', [id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ success: true, message: 'Tanggapan berhasil dikirim' });
  } catch (error) {
    console.error("Gagal mengirim tanggapan:", error);
    return NextResponse.json({ success: false, message: 'Gagal mengirim tanggapan' }, { status: 500 });
  }
}