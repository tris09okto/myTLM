import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db';
import { resolveUploadUrl } from '@/lib/mobile/attachment-path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Hapus spasi kosong yang mungkin tidak sengaja terbawa pada NIK
  const nik = searchParams.get('nik')?.trim();

  if (!nik) {
    return NextResponse.json({ error: 'NIK diperlukan' }, { status: 400 });
  }

  try {
    // Ambil pesan khusus untuk NIK ini, ATAU pesan yang ditujukan untuk 'ALL' / 'SEMUA'
    const query = `
      SELECT id, pengirim_role, tipe_pesan, konten, file_lampiran, is_read, created_at 
      FROM pesan_notifikasi 
      WHERE penerima_nik = ? OR penerima_nik = 'ALL' OR penerima_nik = 'SEMUA'
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(query, [nik]);

    const rowsWithUrls = await Promise.all(rows.map(async (row) => ({
      ...row,
      attachment_url: await resolveUploadUrl(row.file_lampiran),
    })));
    return NextResponse.json(rowsWithUrls);
  } catch (error) {
    console.error('Fetch Notifikasi Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil notifikasi' }, { status: 500 });
  }
}
