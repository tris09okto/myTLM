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
    const tanggal = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const [rows] = await pool.query<AttendanceRow[]>(
      "SELECT waktu_masuk, waktu_keluar FROM absensi WHERE nik = ? AND tanggal = ? LIMIT 1",
      [employee.nik, tanggal],
    );
    return NextResponse.json({
      tanggal,
      waktuMasuk: rows[0]?.waktu_masuk ?? null,
      waktuPulang: rows[0]?.waktu_keluar ?? null,
      sudahMasuk: Boolean(rows[0]?.waktu_masuk),
      sudahPulang: Boolean(rows[0]?.waktu_keluar),
    });
  } catch {
    return NextResponse.json({ message: "Unable to load attendance" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const employee = await currentEmployee(request);
  if (!employee) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Gunakan multipart/form-data" }, { status: 400 });
  }

  const kind = form.get("jenis_absen");
  if (kind !== "Masuk" && kind !== "Pulang") {
    return NextResponse.json({ message: "Jenis absensi tidak valid" }, { status: 400 });
  }

  const photo = form.get("foto_absen");
  if (!(photo instanceof File) || !photo.size || !photo.type.startsWith("image/")) {
    return NextResponse.json({ message: "Foto absensi wajib berupa gambar" }, { status: 400 });
  }

  const latitude = form.get("latitude");
  const longitude = form.get("longitude");
  const address = form.get("lokasi_alamat");
  const validLocation = typeof latitude === "string" && latitude.trim() !== "" &&
    Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90 &&
    typeof longitude === "string" && longitude.trim() !== "" &&
    Number.isFinite(Number(longitude)) && Math.abs(Number(longitude)) <= 180 &&
    typeof address === "string" && address.trim() !== "";
  if (!validLocation) {
    return NextResponse.json({ message: "Lokasi absensi tidak valid" }, { status: 400 });
  }

  form.set("nik", employee.nik);
  form.set("nama", employee.nama);
  form.set("unit_kerja", employee.unit_kerja);

  const response = await recordAttendance(new Request(request.url, { method: "POST", body: form }));
  const result: unknown = await response.json();
  if (result && typeof result === "object" && "error" in result && typeof result.error === "string") {
    return NextResponse.json({ success: false, message: result.error }, { status: response.status });
  }

  return NextResponse.json(result, { status: response.status });
}
