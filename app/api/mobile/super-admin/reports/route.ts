import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface ReportRow extends RowDataPacket { deskripsi: string }

export async function PUT(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "super_admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("id" in body) || !("answer" in body) ||
      typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0 ||
      typeof body.answer !== "string" || !body.answer.trim() || body.answer.length > 5000) {
    return NextResponse.json({ message: "Invalid reply" }, { status: 400 });
  }
  try {
    const [reports] = await pool.query<ReportRow[]>(
      "SELECT deskripsi FROM qna_materi WHERE id = ? AND kategori = 'Aduan Super Admin' LIMIT 1",
      [body.id],
    );
    if (!reports[0]) return NextResponse.json({ message: "Report not found" }, { status: 404 });
    const question = reports[0].deskripsi.split("\n\nJawaban :\n")[0];
    await pool.query("UPDATE qna_materi SET deskripsi = ? WHERE id = ?", [
      `${question}\n\nJawaban :\n${body.answer.trim()}`, body.id,
    ]);
    return NextResponse.json({ success: true, message: "Balasan berhasil dikirim." });
  } catch {
    return NextResponse.json({ message: "Unable to send reply" }, { status: 500 });
  }
}
