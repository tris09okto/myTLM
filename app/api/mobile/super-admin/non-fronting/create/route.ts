import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

import { createNonFrontingAccount } from '@/lib/mobile/create-non-fronting';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'super_admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: 'Gunakan multipart/form-data' }, { status: 400 });
  }
  const mitraId = form.get('id_mitra');
  if (mitraId) {
    if (typeof mitraId !== 'string' || !/^\d+$/.test(mitraId) || Number(mitraId) <= 0)
      return NextResponse.json({ message: 'Mitra tidak valid' }, { status: 400 });
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM mitra WHERE id = ?', [
      mitraId,
    ]);
    if (!rows.length)
      return NextResponse.json({ message: 'Mitra tidak ditemukan' }, { status: 400 });
  }
  return createNonFrontingAccount(new Request(request.url, { method: 'POST', body: form }));
}
