import { NextResponse } from "next/server";

import { POST as uploadQna } from "@/app/super-admin/upload-qna/route";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "super_admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return uploadQna(request);
}
