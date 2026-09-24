import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";

export const runtime = "nodejs";

interface ChatRow extends RowDataPacket { messages: string | unknown }
type ChatMessage = { role: "user" | "agent"; text: string };

function isMessage(value: unknown): value is ChatMessage {
  return !!value && typeof value === "object" && "role" in value && "text" in value &&
    (value.role === "user" || value.role === "agent") &&
    typeof value.text === "string" && value.text.length <= 5000;
}

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "pegawai") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const [rows] = await pool.query<ChatRow[]>(
      "SELECT messages FROM chat_history_array WHERE user_id = ? LIMIT 1", [principal.username],
    );
    const raw: unknown = typeof rows[0]?.messages === "string" ? JSON.parse(rows[0].messages) : rows[0]?.messages;
    return NextResponse.json({ messages: Array.isArray(raw) ? raw.filter(isMessage) : [] });
  } catch {
    return NextResponse.json({ message: "Unable to load chat history" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || principal.role !== "pegawai") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("messages" in body) ||
      !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40 ||
      !body.messages.every(isMessage) || body.messages.at(-1)?.role !== "user") {
    return NextResponse.json({ message: "Invalid chat messages" }, { status: 400 });
  }
  const messages: ChatMessage[] = body.messages;
  try {
    const { text } = await generateText({
      model: google("gemini-3.6-flash"),
      system: "Anda adalah asisten AI internal perusahaan. Jawablah pertanyaan dari pegawai dengan sopan, akurat, informatif, dan profesional.",
      messages: messages.map((item) => ({ role: item.role === "agent" ? "assistant" : "user", content: item.text })),
    });
    const saved = [...messages, { role: "agent" as const, text }];
    const serialized = JSON.stringify(saved);
    await pool.query(
      `INSERT INTO chat_history_array (user_id, messages) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE messages = VALUES(messages)`,
      [principal.username, serialized],
    );
    return NextResponse.json({ reply: text, messages: saved });
  } catch {
    return NextResponse.json({ message: "Asisten QnA belum dapat menjawab. Coba lagi nanti." }, { status: 503 });
  }
}
