import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface IdentityRow extends RowDataPacket {
  nik?: string;
  area?: string;
}

function areas(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || !["pegawai", "leader"].includes(principal.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    let condition: string;
    let values: string[];
    if (principal.role === "pegawai") {
      const [profiles] = await pool.query<IdentityRow[]>(
        "SELECT nik FROM master_pegawai WHERE username = ? LIMIT 1",
        [principal.username],
      );
      if (!profiles[0]?.nik) return NextResponse.json({ entries: [] });
      condition = "nik_fronting = ?";
      values = [profiles[0].nik];
    } else {
      const [profiles] = await pool.query<IdentityRow[]>(
        "SELECT area FROM data_leader WHERE username = ? LIMIT 1",
        [principal.username],
      );
      values = areas(profiles[0]?.area);
      if (!values.length) return NextResponse.json({ entries: [] });
      condition = `area IN (${values.map(() => "?").join(",")})`;
    }

    const [entries] = await pool.query<RowDataPacket[]>(
      `SELECT id, nik_fronting, nama_fronting, nama_nasabah, produk,
              up_pengajuan, area, status, created_at
       FROM entri_data_perkiraan_pemasukan
       WHERE ${condition} ORDER BY created_at DESC`,
      values,
    );
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ message: "Unable to load income status" }, { status: 500 });
  }
}
