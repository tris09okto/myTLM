import { NextResponse } from "next/server";

import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getMobilePrincipal(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user }, { status: 200 });
}
