import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, oldPassword, newPassword } = body;

    if (!username || !oldPassword || !newPassword) {
      return NextResponse.json({ success: false, message: 'Data permintaan tidak lengkap.' }, { status: 400 });
    }

    // Ambil data leader / supervisor berdasarkan username
    const [leaders] = await pool.query(
      `SELECT * FROM data_leader WHERE username = ?`,
      [username]
    ) as [any[], any];

    if (leaders.length === 0) {
      return NextResponse.json({ success: false, message: 'Akun leaders tidak ditemukan.' }, { status: 404 });
    }

    const leader = leaders[0];

    // Periksa kecocokan password lama (mendukung hash bcrypt atau teks biasa)
    let isMatch = false;
    if (leader.password && (leader.password.startsWith('$2b$') || leader.password.startsWith('$2a$'))) {
      isMatch = await bcrypt.compare(oldPassword, leader.password);
    } else {
      isMatch = (leader.password === oldPassword);
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Password lama yang Anda masukkan salah!' }, { status: 400 });
    }

    // Hash password baru jika sistem menggunakan bcrypt, atau simpan langsung
    let finalNewPassword = newPassword;
    if (leader.password && (leader.password.startsWith('$2b$') || leader.password.startsWith('$2a$'))) {
      finalNewPassword = await bcrypt.hash(newPassword, 10);
    }

    // Update password di database tabel data_leader
    await pool.query(
      `UPDATE data_leader SET password = ? WHERE username = ?`,
      [finalNewPassword, username]
    );

    await pool.query(
      `UPDATE users SET password = ? WHERE username = ?`,
      [finalNewPassword, username]
    );

    return NextResponse.json({ success: true, message: 'Password berhasil diperbarui.' }, { status: 200 });

  } catch (error) {
    console.error('Database Error pada /api/leaders/change-password:', error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan internal pada server.' }, { status: 500 });
  }
}