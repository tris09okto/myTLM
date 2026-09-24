import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { POST as recordAttendance } from "@/app/api/pegawai/absen/route";
import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface EmployeeRow extends RowDataPacket { nik: string; nama: string; unit_kerja: string }
interface AttendanceRow extends RowDataPacket { waktu_masuk: string | null; waktu_keluar: string | null }

async function currentEmployee(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "pegawai") return null;
  const [rows] = await pool.query<EmployeeRow[]>(
    "SELECT nik, nama, unit_kerja FROM data_non_fronting WHERE username = ? LIMIT 1",
    [principal.username],
  );
  return rows[0] ?? null;
}

export async function GET(request: Request) {
  const employee = await currentEmployee(request);
  if (!employee) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const [rows] = await pool.query<AttendanceRow[]>(
      "SELECT waktu_masuk, waktu_keluar FROM absensi WHERE nik = ? AND tanggal = CURDATE() LIMIT 1",
      [employee.nik],
    );
    return NextResponse.json({ sudahMasuk: Boolean(rows[0]?.waktu_masuk), sudahPulang: Boolean(rows[0]?.waktu_keluar) });
  } catch {
    return NextResponse.json({ message: "Unable to load attendance" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const employee = await currentEmployee(request);
  if (!employee) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("jenis_absen" in body) ||
      (body.jenis_absen !== "Masuk" && body.jenis_absen !== "Pulang")) {
    return NextResponse.json({ message: "Jenis absensi tidak valid" }, { status: 400 });
  }
  return recordAttendance(new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nik: employee.nik,
      nama: employee.nama,
      unit_kerja: employee.unit_kerja,
      lokasi: "Kantor / Lapangan",
      jenis_absen: body.jenis_absen,
    }),
  }));
}
