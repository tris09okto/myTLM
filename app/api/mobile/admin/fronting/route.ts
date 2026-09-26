import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const leaderName = params.get("leaderName")?.trim() ?? "";
  const kanwil = params.get("kanwil")?.trim() ?? "";
  const area = params.get("area")?.trim() ?? "";
  const penempatan = params.get("penempatan")?.trim() ?? "";

  if (
    [leaderName, kanwil, area, penempatan].some((value) => value.length > 128) ||
    (leaderName && (kanwil || area || penempatan)) ||
    (area && !kanwil) ||
    (penempatan && !area)
  ) {
    return NextResponse.json({ message: "Invalid fronting filters" }, { status: 400 });
  }

  try {
    if (leaderName) {
      const [employees] = await pool.query<RowDataPacket[]>(
        `SELECT id, nama, nik, kanwil, area, penempatan, leader, jenis_pegawai
         FROM master_pegawai
         WHERE jenis_pegawai = 'fronting' AND leader = ?
         ORDER BY nama`,
        [leaderName],
      );
      return NextResponse.json(employees);
    }

    let query = `SELECT p.id, p.nama, p.nik, p.kanwil, p.area, p.penempatan,
                        p.leader, p.jenis_pegawai, t.estimasi
                 FROM master_pegawai p
                 LEFT JOIN transaksi_gaji t
                   ON p.id = t.id_pegawai AND t.employee_kind = 'fronting'
                 WHERE p.jenis_pegawai = 'fronting'`;
    const values: string[] = [];
    for (const [column, value] of [
      ["kanwil", kanwil],
      ["area", area],
      ["penempatan", penempatan],
    ] as const) {
      if (value) {
        query += ` AND p.${column} = ?`;
        values.push(value);
      }
    }
    query += " ORDER BY p.nama";
    const [employees] = await pool.query<RowDataPacket[]>(query, values);
    return NextResponse.json(employees);
  } catch {
    return NextResponse.json({ message: "Unable to load fronting employees" }, { status: 500 });
  }
}
