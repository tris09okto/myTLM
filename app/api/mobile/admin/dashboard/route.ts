import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface CountRow extends RowDataPacket { total: number }
interface UnitCountRow extends RowDataPacket { unit_kerja: string; total: number }

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [frontingCount] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM master_pegawai WHERE jenis_pegawai = 'fronting' AND LOWER(nik) NOT LIKE '%test%'",
    );
    const [nonFrontingCounts] = await pool.query<UnitCountRow[]>(
      "SELECT unit_kerja, COUNT(*) AS total FROM data_non_fronting GROUP BY unit_kerja",
    );
    const [leaders] = await pool.query<RowDataPacket[]>(
      "SELECT id, nama_leader, kanwil, area, penempatan FROM data_leader ORDER BY nama_leader",
    );
    const [fronting] = await pool.query<RowDataPacket[]>(
      `SELECT id, nik, nama, kanwil, area, penempatan, leader, jenis_pegawai
       FROM master_pegawai WHERE jenis_pegawai = 'fronting' ORDER BY nama`,
    );
    const [areas] = await pool.query<RowDataPacket[]>(
      "SELECT kanwil, area, penempatan FROM master_wilayah WHERE kanwil IS NOT NULL AND area IS NOT NULL AND penempatan IS NOT NULL",
    );
    return NextResponse.json({
      jabatan: principal.jabatan,
      frontingCount: Number(frontingCount[0]?.total ?? 0),
      nonFrontingCounts,
      leaders,
      fronting,
      areas,
    });
  } catch {
    return NextResponse.json({ message: "Unable to load admin dashboard" }, { status: 500 });
  }
}
