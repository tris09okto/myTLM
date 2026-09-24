import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import * as xlsx from "xlsx";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { POST as saveLeader } from "@/app/api/leaders/route";

export const runtime = "nodejs";

interface ExistingLeader extends RowDataPacket { id: number }

function value(row: Record<string, unknown>, key: string) {
  const found = Object.entries(row).find(([header]) => header.trim().toLowerCase() === key.toLowerCase());
  return found?.[1] == null ? "" : String(found[1]).trim();
}

function locations(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "super_admin") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10_000_000 || !/\.(xlsx|xls)$/i.test(file.name)) {
    return NextResponse.json({ message: "Invalid spreadsheet" }, { status: 400 });
  }

  try {
    const workbook = xlsx.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) return NextResponse.json({ message: "Spreadsheet kosong" }, { status: 400 });
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet);
    if (!rows.length || rows.length > 500) {
      return NextResponse.json({ message: "Spreadsheet harus berisi 1 sampai 500 baris" }, { status: 400 });
    }
    const prepared = rows.map((row, index) => ({
      row: index + 2,
      namaLeader: value(row, "Nama Leader"),
      kanwil: locations(value(row, "Kanwil")),
      area: locations(value(row, "Area")),
      penempatan: locations(value(row, "Penempatan")),
      email: value(row, "Email"),
      username: value(row, "Username"),
      password: value(row, "Password"),
    }));
    const invalid = prepared.find((item) => !item.namaLeader || !item.username || !item.email ||
      !item.kanwil.length || !item.area.length || !item.penempatan.length);
    if (invalid) return NextResponse.json({ message: `Baris ${invalid.row} tidak lengkap` }, { status: 400 });
    const usernames = prepared.map((item) => item.username.toLowerCase());
    if (new Set(usernames).size !== usernames.length) {
      return NextResponse.json({ message: "Username duplikat di spreadsheet" }, { status: 400 });
    }

    let saved = 0;
    for (const item of prepared) {
      const [existing] = await pool.query<ExistingLeader[]>(
        "SELECT id FROM data_leader WHERE username = ? LIMIT 1", [item.username],
      );
      if (!existing[0] && item.password.length < 6) {
        return NextResponse.json({ message: `Baris ${item.row} memerlukan password minimal 6 karakter`, saved }, { status: 400 });
      }
      const response = await saveLeader(new Request(request.url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing[0]?.id, ...item }),
      }));
      if (!response.ok) {
        const result: unknown = await response.json();
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error : "Gagal menyimpan leader";
        return NextResponse.json({ message: `Baris ${item.row}: ${message}`, saved }, { status: response.status });
      }
      saved++;
    }
    return NextResponse.json({ success: true, message: `${saved} leader berhasil diimpor`, saved });
  } catch {
    return NextResponse.json({ message: "Unable to import leaders" }, { status: 500 });
  }
}
