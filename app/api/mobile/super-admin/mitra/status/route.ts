import { NextResponse } from 'next/server';
import { POST as updateStatus } from '@/app/api/mitra/update-status/route';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'super_admin')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  let input;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: 'Data mitra tidak valid' }, { status: 400 });
  }
  if (
    !input ||
    !Number.isSafeInteger(input.id) ||
    input.id <= 0 ||
    !['ACTIVE', 'INACTIVE'].includes(input.status)
  )
    return NextResponse.json({ message: 'Data mitra tidak valid' }, { status: 400 });
  return updateStatus(
    new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
}
