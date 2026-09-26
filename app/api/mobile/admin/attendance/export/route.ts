import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

import { getAdminAttendanceRows } from "@/lib/mobile/admin/attendance-query";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const headers = [
  "nik",
  "nama",
  "unit_kerja",
  "nama_supervisor",
  "tanggal",
  "waktu_masuk",
  "waktu_keluar",
  "lokasi",
  "status",
];

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "admin" || principal.jabatan.toLowerCase() !== "hrd") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!monthPattern.test(month)) {
    return NextResponse.json({ message: "Invalid month" }, { status: 400 });
  }

  try {
    const attendance = await getAdminAttendanceRows(month);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(attendance, { header: headers });
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const filename = `Rekap_Absensi_${month}.xlsx`;

    return new Response(bytes, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch {
    return NextResponse.json({ message: "Unable to export attendance" }, { status: 500 });
  }
}
