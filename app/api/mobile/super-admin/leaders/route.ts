import { NextResponse } from "next/server";

import { POST as saveLeader } from "@/app/api/leaders/route";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "super_admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const form = await request.formData();
  const name = form.get("namaLeader");
  const email = form.get("email");
  const username = form.get("username");
  const password = form.get("password");
  const id = form.get("id");
  const image = form.get("idcard_file");
  const locations = ["kanwil", "area", "penempatan"] as const;
  const arrays = locations.map((field) => form.getAll(field));
  if (typeof name !== "string" || !name.trim() ||
      typeof email !== "string" || !email.trim() ||
      typeof username !== "string" || !username.trim() ||
      typeof password !== "string" || (!id && !password) ||
      (id !== null && (typeof id !== "string" || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) ||
      arrays.some((entries) => !entries.length || entries.some((entry) => typeof entry !== "string" || !entry.trim())) ||
      (image !== null && (!(image instanceof File) || !image.type.startsWith("image/") || image.size > 5_000_000))) {
    return NextResponse.json({ message: "Leader tidak valid" }, { status: 400 });
  }
  const imageData = image instanceof File && image.size
    ? `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`
    : null;
  const payload = {
    ...(id ? { id: Number(id) } : {}),
    namaLeader: name.trim(), email: email.trim(), username: username.trim(), password,
    kanwil: arrays[0], area: arrays[1], penempatan: arrays[2], idcard_file: imageData,
  };
  return saveLeader(new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}
