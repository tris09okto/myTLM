import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {pool} from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = String((session?.user as any)?.role || "").toLowerCase();

    if (!session || (role !== "superadmin" && role !== "super_admin")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT *
       FROM data_non_fronting
       WHERE UPPER(TRIM(jabatan)) IN ('SPV', 'SUPERVISOR')
       ORDER BY id DESC`
    );

    // Normalisasi field agar kompatibel dengan tabel List Supervisor maupun modal Edit Supervisor
    const supervisors = rows.map((row) => ({
      ...row,
      no_hp: row.no_hp || row.no_whatsapp || "",
      no_whatsapp: row.no_whatsapp || row.no_hp || "",
      mitra_id: row.mitra_id ?? row.id_mitra ?? "",
      id_mitra: row.id_mitra ?? row.mitra_id ?? "",
    }));

    return NextResponse.json({
      success: true,
      supervisors,
    });
  } catch (error: any) {
    console.error("GET /api/spv/list-data error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Gagal mengambil data supervisor.",
      },
      { status: 500 }
    );
  }
}