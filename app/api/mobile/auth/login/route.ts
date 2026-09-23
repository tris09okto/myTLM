import { NextResponse } from "next/server";

import { parseCredentials } from "@/lib/credentials";
import { signInMobileUser } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const credentials = parseCredentials(await request.json());

    if (!credentials) {
      return NextResponse.json({ message: "Invalid login request" }, { status: 400 });
    }

    const session = await signInMobileUser(credentials);

    if (!session) {
      return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
    }

    return NextResponse.json(session, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Unable to sign in" }, { status: 500 });
  }
}
