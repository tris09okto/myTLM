import { NextResponse } from "next/server";

import { parseRefreshToken } from "@/lib/mobile/auth/helpers";
import { rotateMobileRefreshToken } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const refreshToken = parseRefreshToken(await request.json());

    if (!refreshToken) {
      return NextResponse.json({ message: "Invalid refresh request" }, { status: 400 });
    }

    const session = await rotateMobileRefreshToken(refreshToken);

    if (!session) {
      return NextResponse.json({ message: "Invalid or expired refresh token" }, { status: 401 });
    }

    return NextResponse.json(session, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Unable to refresh session" }, { status: 500 });
  }
}
