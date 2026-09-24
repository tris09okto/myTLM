import { NextResponse } from "next/server";
import { POST as importSpreadsheet } from "@/app/api/keuangan/upload-excel/route";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || !["keuangan", "super_admin"].includes(principal.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const filterType = form.get("filterType");
  const filterValue = form.get("filterValue");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10_000_000 ||
    !/\.(xlsx|xls)$/i.test(file.name) ||
    (filterType !== "area" &&
      filterType !== "pegawai" &&
      filterType !== "leader") ||
    typeof filterValue !== "string" ||
    !filterValue.trim() ||
    filterValue.length > 200
  ) {
    return NextResponse.json(
      { message: "Invalid spreadsheet import" },
      { status: 400 },
    );
  }
  return importSpreadsheet(
    new Request(request.url, { method: "POST", body: form }),
  );
}
