import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';
import { getMitraDashboard } from '@/lib/mobile/mitra-dashboard';
import { resolveUploadUrl } from '@/lib/mobile/attachment-path';

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'mitra')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM mitra WHERE username = ? LIMIT 1',
    [principal.username],
  );
  if (!rows[0])
    return NextResponse.json({ message: 'Data mitra tidak ditemukan' }, { status: 404 });
  const url = new URL(request.url);
  url.search = '';
  url.searchParams.set('username', principal.username);
  const response = await getMitraDashboard(new Request(url), rows[0].id);
  if (!response.ok) return response;
  const data = await response.json();
  data.pegawaiList = await Promise.all(
    data.pegawaiList.map(
      async (employee: {
        foto_masuk: string | null;
        foto_keluar: string | null;
        file_bukti_izin: string | null;
      }) => ({
        ...employee,
        foto_masuk: await resolveUploadUrl(employee.foto_masuk, 'pegawai/absensi'),
        foto_keluar: await resolveUploadUrl(employee.foto_keluar, 'pegawai/absensi'),
        file_bukti_izin: await resolveUploadUrl(employee.file_bukti_izin, 'izin'),
      }),
    ),
  );
  return NextResponse.json(data);
}
