import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { nik, oldPassword, newPassword } = body;

    if (!nik || !oldPassword || !newPassword) {
      return NextResponse.json({ success: false, message: 'Harap lengkapi semua data' }, { status: 400 });
    }

    // 1. Cari data user di tabel users berdasarkan NIK (username)
    // Sesuaikan nama tabel 'users' dan kolom 'username'/'password' dengan skema DB Anda
    const [userRows] = await pool.query(
      `SELECT * FROM users WHERE username = ? LIMIT 1`, 
      [nik]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Akun tidak ditemukan' }, { status: 404 });
    }

    const user = userRows[0];

    // 2. Verifikasi Password Lama
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordMatch) {
      return NextResponse.json({ success: false, message: 'Password lama yang Anda masukkan salah' }, { status: 401 });
    }

    // 3. Hash Password Baru
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 4. Update Password di Database
    await pool.query(
      `UPDATE users SET password = ? WHERE username = ?`,
      [hashedNewPassword, nik]
    );

    return NextResponse.json({ success: true, message: 'Password berhasil diubah' });

  } catch (error) {
    console.error("Gagal ganti password:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}