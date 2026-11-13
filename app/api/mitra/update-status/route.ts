import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: "ID dan status wajib disertakan!" },
        { status: 400 }
      );
    }

    await pool.query("UPDATE mitra SET status = ? WHERE id = ?", [status, id]);

    return NextResponse.json({
      success: true,
      message: `Status mitra berhasil diubah menjadi ${status}!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}