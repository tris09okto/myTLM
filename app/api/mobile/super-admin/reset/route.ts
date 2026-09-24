import { NextResponse } from "next/server";

import { POST as resetIncomeAndPayroll } from "@/app/super-admin/reset-table/route";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "super_admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("confirm" in body) || body.confirm !== "RESET_INCOME_AND_PAYROLL") {
    return NextResponse.json({ message: "Confirmation required" }, { status: 400 });
  }
  return resetIncomeAndPayroll(request);
}
