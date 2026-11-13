import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db';
import { getMobilePrincipal } from '@/lib/mobile/auth/service';
import { POST as submitLeave } from '@/app/api/pegawai/pengajuan-izin/route';

export const runtime = 'nodejs';

enum MobileRole {
  Employee = 'pegawai',
  Supervisor = 'supervisor',
}

enum LeaveStatus {
  Pending = 'PENDING',
  Approved = 'DISETUJUI',
  Rejected = 'DITOLAK',
}

enum LeaveKind {
  Sick = 'Sakit',
  Personal = 'Izin Keperluan Pribadi',
  Annual = 'Cuti Tahunan',
  Special = 'Cuti Khusus',
  Duty = 'Dinas Luar',
}

interface Profile extends RowDataPacket {
  nik: string;
  nama: string;
  username: string;
  unit_kerja: string;
}
interface Leave extends RowDataPacket {
  id: number;
  nik: string;
  status: LeaveStatus;
}
async function identity(request: Request) {
  const principal = await getMobilePrincipal(request);
  const allowedRole =
    principal && Object.values(MobileRole).some((role) => role === principal.role);
  if (!allowedRole) return null;

  const [rows] = await pool.query<Profile[]>(
    'SELECT nik, nama, username, unit_kerja FROM data_non_fronting WHERE username = ? LIMIT 1',
    [principal.username],
  );

  return rows[0] ? { profile: rows[0], role: principal.role } : null;
}
const ownership = `LOWER(TRIM(p.supervisor)) IN (LOWER(TRIM(?)), LOWER(TRIM(?)), LOWER(TRIM(?)))`;
export async function GET(request: Request) {
  try {
    const user = await identity(request);
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const supervisor = user.role === MobileRole.Supervisor;
    const [data] = await pool.query(
      `SELECT i.*, DATE_FORMAT(i.tanggal_mulai, '%Y-%m-%d') AS tanggal_mulai, DATE_FORMAT(i.tanggal_selesai, '%Y-%m-%d') AS tanggal_selesai, p.nama FROM pengajuan_izin i JOIN data_non_fronting p ON p.nik = i.nik WHERE ${supervisor ? ownership : 'i.nik = ?'} ORDER BY i.id DESC`,
      supervisor
        ? [user.profile.username, user.profile.nama, user.profile.nik]
        : [user.profile.nik],
    );

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ message: 'Gagal memuat pengajuan izin' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await identity(request);
    if (!user || user.role !== MobileRole.Employee)
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const form = await request.formData();
    const kind = form.get('jenis_izin');
    const start = form.get('tanggal_mulai');
    const end = form.get('tanggal_selesai');
    const reason = form.get('alasan');
    const validDate = (value: FormDataEntryValue | null): value is string =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    const validRequest =
      typeof kind === 'string' &&
      Object.values(LeaveKind).some((value) => value === kind) &&
      validDate(start) &&
      validDate(end) &&
      end >= start &&
      typeof reason === 'string' &&
      Boolean(reason.trim());
    if (!validRequest)
      return NextResponse.json(
        { message: 'Jenis, tanggal, atau alasan tidak valid' },
        { status: 400 },
      );

    form.set('nik', user.profile.nik);
    form.set('nama', user.profile.nama);
    form.set('unit_kerja', user.profile.unit_kerja);

    return submitLeave(new Request(request.url, { method: 'POST', body: form }));
  } catch {
    return NextResponse.json({ message: 'Pengajuan tidak valid' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const user = await identity(request);
  if (!user || user.role !== MobileRole.Supervisor)
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }
  const decision = parseDecision(body);
  if (!decision) return NextResponse.json({ message: 'Keputusan tidak valid' }, { status: 400 });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<Leave[]>(
      `SELECT i.id, i.nik, i.status FROM pengajuan_izin i JOIN data_non_fronting p ON p.nik = i.nik WHERE i.id = ? AND ${ownership} FOR UPDATE`,
      [decision.id, user.profile.username, user.profile.nama, user.profile.nik],
    );

    const leave = rows[0];
    if (!leave || leave.status !== LeaveStatus.Pending) {
      await connection.rollback();
      return NextResponse.json(
        { message: 'Pengajuan tidak ditemukan atau sudah diproses' },
        { status: 409 },
      );
    }

    await connection.query(
      'UPDATE pengajuan_izin SET status = ?, catatan_spv = ?, approved_by = ?, updated_at = NOW() WHERE id = ?',
      [decision.status, decision.catatan_spv.trim() || null, user.profile.username, leave.id],
    );

    await connection.query(
      "INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at) VALUES ('Supervisor', ?, 'Approval Izin', ?, 0, NOW())",
      [leave.nik, `Pengajuan izin Anda telah ${decision.status}. ${decision.catatan_spv.trim()}`],
    );

    await connection.commit();

    return NextResponse.json({ success: true });
  } catch {
    await connection.rollback();
    return NextResponse.json({ message: 'Gagal memproses pengajuan' }, { status: 500 });
  } finally {
    connection.release();
  }
}

function parseDecision(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  if (!('id' in body) || !('status' in body) || !('catatan_spv' in body)) return null;
  if (typeof body.id !== 'number' || typeof body.catatan_spv !== 'string') return null;

  const invalidFields =
    !Number.isSafeInteger(body.id) || body.id <= 0 || body.catatan_spv.length > 5000;
  if (invalidFields) return null;
  if (body.status === LeaveStatus.Approved || body.status === LeaveStatus.Rejected) {
    return { id: body.id, status: body.status, catatan_spv: body.catatan_spv };
  }

  return null;
}
