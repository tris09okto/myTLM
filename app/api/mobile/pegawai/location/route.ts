import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { POST as updateLocation } from '@/app/api/pegawai/update-lokasi/route';
import { pool } from '@/lib/db';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'pegawai')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Data lokasi tidak valid' }, { status: 400 });
  }
  if (
    !input ||
    typeof input.tagLokasi !== 'string' ||
    !input.tagLokasi.trim() ||
    input.tagLokasi.length > 1000
  )
    return NextResponse.json({ message: 'Tag lokasi wajib diisi' }, { status: 400 });
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT nik FROM data_non_fronting WHERE username = ? LIMIT 1',
    [principal.username],
  );
  if (!rows[0])
    return NextResponse.json({ message: 'Pegawai non-fronting tidak ditemukan' }, { status: 404 });
  return updateLocation(
    new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nik: rows[0].nik, tagLokasi: input.tagLokasi.trim() }),
    }),
  );
}
