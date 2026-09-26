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

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 128) {
    return NextResponse.json({ message: "Search must contain 2 to 128 characters" }, { status: 400 });
  }

  try {
    const pattern = `%${query}%`;
    const [recipients] = await pool.query<RowDataPacket[]>(
      `SELECT nama, nik FROM master_pegawai
       WHERE nama LIKE ? OR nik LIKE ?
       ORDER BY nama LIMIT 25`,
      [pattern, pattern],
    );
    return NextResponse.json({ recipients });
  } catch {
    return NextResponse.json({ message: "Unable to search message recipients" }, { status: 500 });
  }
}
