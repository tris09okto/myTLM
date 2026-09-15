import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
// Pastikan path import ini sesuai dengan lokasi file [...nextauth]/route.js Anda
import { authOptions } from '../../auth/[...nextauth]/route'; 
import {pool} from '@/lib/db'; 

export async function GET(request) {
  try {
    // 1. Ambil data sesi pengguna yang sedang login
    const session = await getServerSession(authOptions);

    // 2. Validasi apakah pengguna sudah login
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Tidak memiliki akses (Unauthorized)' }, 
        { status: 401 }
      );
    }

    // 3. Ambil identifier dari sesi (misalnya username atau email)
    // Catatan: Properti ini (misal: session.user.name) bergantung pada apa 
    // yang Anda return di callback session/jwt pada konfigurasi NextAuth Anda.
    const loggedInUsername = session.user.name; // Atau session.user.username

    // 4. Lakukan query ke database menggunakan data dinamis dari sesi
    const [rows] = await pool.query(`
      SELECT id, username, jabatan, role 
      FROM users 
      WHERE username = ? 
      LIMIT 1
    `, [loggedInUsername]);

    if (rows.length > 0) {
      return NextResponse.json({ success: true, data: rows[0] });
    } else {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan di database' }, { status: 404 });
    }
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}