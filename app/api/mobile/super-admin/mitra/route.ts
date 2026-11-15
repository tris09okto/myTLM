import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { POST as createMitra } from '@/app/api/mitra/create/route';
import { updateMitra } from '@/lib/mobile/mitra-update';
import { pool } from '@/lib/db';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'super_admin')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const [data] = await pool.query<RowDataPacket[]>(
    'SELECT id, kode_mitra, nama_mitra, username, email, no_telp, alamat_mitra, status FROM mitra ORDER BY id DESC',
  );
  return NextResponse.json({ success: true, data });
}

async function save(request: Request, editing: boolean) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'super_admin')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Data mitra tidak valid' }, { status: 400 });
  }
  const fields = ['kode_mitra', 'nama_mitra', 'email', 'no_telp', 'alamat_mitra', 'username'];
  const valid =
    input &&
    fields.every((field) => typeof input[field] === 'string' && input[field].trim()) &&
    typeof input.password === 'string' &&
    (editing || input.password.length > 0) &&
    ['ACTIVE', 'INACTIVE'].includes(input.status) &&
    (!editing || (Number.isSafeInteger(input.id) && input.id > 0));
  if (!valid) return NextResponse.json({ message: 'Data mitra tidak lengkap' }, { status: 400 });
  const forwarded = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return editing ? updateMitra(forwarded) : createMitra(forwarded);
}

export async function POST(request: Request) {
  return save(request, false);
}
export async function PUT(request: Request) {
  return save(request, true);
}
