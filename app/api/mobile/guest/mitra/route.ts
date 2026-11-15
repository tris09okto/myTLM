import { NextResponse } from 'next/server';
import { GET as getWebData } from '@/app/api/guest/mitra/route';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== 'guest')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  url.searchParams.set('username', principal.username);
  const date = url.searchParams.get('date');
  const search = url.searchParams.get('search') ?? '';
  const validDate =
    !date ||
    (/^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date);
  if (!validDate || search.length > 128)
    return NextResponse.json({ message: 'Filter tidak valid' }, { status: 400 });
  if (!date)
    url.searchParams.set(
      'date',
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
    );
  return getWebData(new Request(url));
}
