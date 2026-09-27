import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

const filterColumns = {
  nama: "nama",
  kanwil: "kanwil",
  area: "area",
  penempatan: "penempatan",
} as const;

type FilterColumn = keyof typeof filterColumns;

interface TeamRow extends RowDataPacket {
  nik: string;
  nama: string;
  kanwil: string;
  area: string;
  penempatan: string;
  omset: string | number;
}

function isFilterColumn(value: string): value is FilterColumn {
  return Object.hasOwn(filterColumns, value);
}

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "guest") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const search = new URL(request.url).searchParams;
  const filterBy = search.get("filterBy") ?? "nama";
  const keyword = (search.get("keyword") ?? "").trim();
  if (!isFilterColumn(filterBy) || keyword.length > 128) {
    return NextResponse.json({ message: "Invalid search" }, { status: 400 });
  }

  try {
    const where = keyword ? `WHERE p.${filterColumns[filterBy]} LIKE ?` : "";
    const [team] = await pool.query<TeamRow[]>(
      `SELECT p.nik, p.nama, p.kanwil, p.area, p.penempatan,
              COALESCE(SUM(e.up_pengajuan), 0) AS omset
       FROM master_pegawai p
       LEFT JOIN entri_data_perkiraan_pemasukan e
         ON e.nik_fronting = p.nik
         AND (e.status LIKE '%Close%' OR e.status = 'Disetujui')
       ${where}
       GROUP BY p.nik, p.nama, p.kanwil, p.area, p.penempatan
       ORDER BY p.nama`,
      keyword ? [`%${keyword}%`] : [],
    );

    return NextResponse.json({
      guest: { username: principal.username },
      totalFronting: team.length,
      totalKanwil: new Set(team.map((member) => member.kanwil).filter(Boolean)).size,
      totalArea: new Set(team.map((member) => member.area).filter(Boolean)).size,
      totalPenempatan: new Set(team.map((member) => member.penempatan).filter(Boolean)).size,
      team,
    });
  } catch {
    return NextResponse.json({ message: "Unable to load guest dashboard" }, { status: 500 });
  }
}
