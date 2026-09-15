import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { pool } from "@/lib/db";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false }, { status: 401 });

    // DEBUG: Lihat apa isi session di terminal server Anda
    console.log("Session Data:", session); 
    
    const username = session.user.name; 
    const role = session.user.role?.toLowerCase() || ""; 
    console.log("Querying username:", username, "| Role:", role);

    let primaryQuery = "";
    let fallbackQuery = "";

    // Tentukan prioritas pencarian tabel berdasarkan role login
    if (['security', 'obcs', 'teknisi'].includes(role)) {
      primaryQuery = "SELECT * FROM data_non_fronting WHERE username = ?";
      fallbackQuery = "SELECT * FROM master_pegawai WHERE username = ?";
    } else {
      primaryQuery = "SELECT * FROM master_pegawai WHERE username = ?";
      fallbackQuery = "SELECT * FROM data_non_fronting WHERE username = ?";
    }

    // 1. Coba cari di tabel utama
    const [rows] = await pool.query(primaryQuery, [username]);
    console.log("Primary DB Result:", rows);

    if (rows.length > 0) {
      return NextResponse.json({ success: true, data: rows[0] });
    }

    // 2. Jika kosong, lakukan Fallback (Cari di tabel cadangan)
    // Ini berguna jika session.role gagal dimuat tapi username valid
    console.log("Mencari di tabel fallback...");
    const [fallbackRows] = await pool.query(fallbackQuery, [username]);
    console.log("Fallback DB Result:", fallbackRows);

    if (fallbackRows.length > 0) {
      return NextResponse.json({ success: true, data: fallbackRows[0] });
    }

    // 3. Jika di kedua tabel tetap kosong
    return NextResponse.json({ success: false, message: 'Data tidak ditemukan di database' }, { status: 404 });
    
  } catch (error) {
    console.error("Profile API Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}