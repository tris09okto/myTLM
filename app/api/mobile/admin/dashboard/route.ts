import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface CountRow extends RowDataPacket { total: number }
interface UnitCountRow extends RowDataPacket { unit_kerja: string | null; total: number }

type NonFrontingCounts = {
  obCs: number;
  security: number;
  driver: number;
  technician: number;
  gondola: number;
};

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [frontingCount] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM master_pegawai WHERE jenis_pegawai = 'fronting' AND LOWER(nik) NOT LIKE '%test%'",
    );
    const [unitCounts] = await pool.query<UnitCountRow[]>(
      "SELECT unit_kerja, COUNT(*) AS total FROM data_non_fronting GROUP BY unit_kerja",
    );
    const [leaders] = await pool.query<RowDataPacket[]>(
      "SELECT id, nama_leader, kanwil, area, penempatan FROM data_leader ORDER BY nama_leader",
    );
    const [areas] = await pool.query<RowDataPacket[]>(
      "SELECT kanwil, area, penempatan FROM master_wilayah WHERE kanwil IS NOT NULL AND area IS NOT NULL AND penempatan IS NOT NULL",
    );

    const nonFrontingCounts: NonFrontingCounts = {
      obCs: 0,
      security: 0,
      driver: 0,
      technician: 0,
      gondola: 0,
    };
    for (const row of unitCounts) {
      const unit = row.unit_kerja?.toLowerCase() ?? "";
      const count = Number(row.total);
      if (unit.includes("ob") || unit.includes("cs") || unit.includes("cleaning")) {
        nonFrontingCounts.obCs += count;
      } else if (unit.includes("security") || unit.includes("satpam")) {
        nonFrontingCounts.security += count;
      } else if (unit.includes("driver") || unit.includes("supir")) {
        nonFrontingCounts.driver += count;
      } else if (unit.includes("teknisi")) {
        nonFrontingCounts.technician += count;
      } else if (unit.includes("gondola")) {
        nonFrontingCounts.gondola += count;
      }
    }

    return NextResponse.json({
      jabatan: principal.jabatan,
      frontingCount: Number(frontingCount[0]?.total ?? 0),
      nonFrontingCounts,
      leaders,
      areas,
    });
  } catch {
    return NextResponse.json({ message: "Unable to load admin dashboard" }, { status: 500 });
  }
}
