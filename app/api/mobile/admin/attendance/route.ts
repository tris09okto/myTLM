import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "admin" || principal.jabatan.toLowerCase() !== "hrd") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const month = new URL(request.url).searchParams.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ message: "Invalid month" }, { status: 400 });
  }
  try {
    const [attendance] = await pool.query<RowDataPacket[]>(
      `SELECT nik, nama, unit_kerja, nama_supervisor, tanggal, waktu_masuk,
              waktu_keluar, lokasi, status FROM absensi
       WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
       ORDER BY tanggal ASC, waktu_masuk ASC`,
      [month],
    );
    return NextResponse.json({ attendance });
  } catch {
    return NextResponse.json({ message: "Unable to load attendance" }, { status: 500 });
  }
}
