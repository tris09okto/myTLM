import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function updateMitra(req: Request) {
  let conn;
  try {
    const body = await req.json();
    const { id, kode_mitra, nama_mitra, email, no_telp, alamat_mitra, status, username, password } =
      body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Mitra wajib disertakan!' },
        { status: 400 },
      );
    }

    const cleanUsername = username ? username.trim() : null;

    // Ambil koneksi dari pool untuk database transaction
    conn = await pool.getConnection();

    // 1. Ambil data mitra lama (untuk acuan username sebelumnya)
    const [existingRows]: any = await conn.query('SELECT username FROM mitra WHERE id = ?', [id]);

    if (existingRows.length === 0) {
      conn.release();
      return NextResponse.json(
        { success: false, message: 'Data mitra tidak ditemukan!' },
        { status: 404 },
      );
    }

    const oldUsername = existingRows[0].username;

    // 2. Cek keunikan username baru jika terjadi perubahan username
    if (cleanUsername && cleanUsername !== oldUsername) {
      const [checkMitra]: any = await conn.query(
        'SELECT id FROM mitra WHERE username = ? AND id != ?',
        [cleanUsername, id],
      );

      const [checkUsers]: any = await conn.query(
        'SELECT id FROM users WHERE username = ? AND username != ?',
        [cleanUsername, oldUsername || ''],
      );

      if (checkMitra.length > 0 || checkUsers.length > 0) {
        conn.release();
        return NextResponse.json(
          { success: false, message: 'Username sudah digunakan oleh akun lain!' },
          { status: 400 },
        );
      }
    }

    // 3. Mulai Transaksi Database
    await conn.beginTransaction();

    let hashedPassword: string | null = null;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    // 4. Update Tabel Mitra
    if (hashedPassword) {
      await conn.query(
        `UPDATE mitra 
         SET kode_mitra = ?, nama_mitra = ?, email = ?, no_telp = ?, alamat_mitra = ?, status = ?, username = ?, password = ? 
         WHERE id = ?`,
        [
          kode_mitra,
          nama_mitra,
          email,
          no_telp,
          alamat_mitra,
          status,
          cleanUsername,
          hashedPassword,
          id,
        ],
      );
    } else {
      await conn.query(
        `UPDATE mitra 
         SET kode_mitra = ?, nama_mitra = ?, email = ?, no_telp = ?, alamat_mitra = ?, status = ?, username = ? 
         WHERE id = ?`,
        [kode_mitra, nama_mitra, email, no_telp, alamat_mitra, status, cleanUsername, id],
      );
    }

    // 5. Update Tabel Users (Sinkronisasi akun login berdasarkan oldUsername)
    if (oldUsername && oldUsername.trim() !== '') {
      if (hashedPassword) {
        await conn.query(
          `UPDATE users 
           SET username = ?, password = ?
           WHERE username = ?`,
          [cleanUsername, hashedPassword, oldUsername],
        );
      } else {
        await conn.query(
          `UPDATE users 
           SET username = ?
           WHERE username = ?`,
          [cleanUsername, oldUsername],
        );
      }
    }

    // 6. Commit transaksi
    await conn.commit();
    conn.release();

    return NextResponse.json({
      success: true,
      message: 'Data mitra dan akun user berhasil diperbarui!',
    });
  } catch (error: any) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan sistem.' },
      { status: 500 },
    );
  }
}
