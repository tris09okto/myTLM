import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { RowDataPacket } from "mysql2";
import { authOptions } from "@/lib/auth";
import {pool} from "@/lib/db";

interface SupervisorRow extends RowDataPacket {
  id: number;
  nama: string;
  email: string;
  username: string | null;
  no_hp: string | null;
  mitra_id: number | null;
  unit_kerja: string | null;
  nama_mitra: string | null;
}

// GET /api/supervisors -> Ambil semua data supervisor
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role?.toUpperCase() !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak" },
        { status: 403 }
      );
    }

    const [rows] = await pool.execute<SupervisorRow[]>(
      `SELECT 
         u.id,
         u.nama,
         u.email,
         u.username,
         u.no_hp,
         u.mitra_id,
         u.unit_kerja,
         m.nama_mitra
       FROM users u
       LEFT JOIN mitra m ON u.mitra_id = m.id
       WHERE UPPER(u.role) = 'SUPERVISOR'
       ORDER BY u.id DESC`
    );

    const supervisors = rows.map((row) => ({
      id: row.id,
      nama: row.nama,
      email: row.email,
      username: row.username,
      no_hp: row.no_hp,
      mitra_id: row.mitra_id,
      unit_kerja: row.unit_kerja,
      mitra: row.mitra_id
        ? { id: row.mitra_id, nama_mitra: row.nama_mitra ?? "" }
        : null,
    }));

    return NextResponse.json({ success: true, data: supervisors });
  } catch (error) {
    console.error("GET /api/supervisors error:", error);
    return NextResponse.json(
      { success: false, message: "Gagal memuat daftar supervisor" },
      { status: 500 }
    );
  }
}