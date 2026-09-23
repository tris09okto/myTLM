import { NextResponse } from "next/server";

import { parseRefreshToken } from "@/lib/mobile/auth/helpers";
import { revokeMobileRefreshToken } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const refreshToken = parseRefreshToken(await request.json());

    if (refreshToken) {
      await revokeMobileRefreshToken(refreshToken);
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: "Unable to sign out" }, { status: 500 });
  }
}
