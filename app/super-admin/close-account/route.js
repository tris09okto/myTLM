import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan path koneksi database Anda

export async function POST(request) {
  try {
    const { id } = await request.json();

    let username = "";

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID Akun tidak valid!' }, { status: 400 });
    }

    // Keep stored files in place; another row may still reference the same legacy file.
    const [rows] = await pool.query('SELECT username FROM master_pegawai WHERE id = ?', [id]);
    
    if (rows.length > 0) {
      const userData = rows[0];

      username = userData.username;

    }

    // 2. Hapus data dari Database
    await pool.query('DELETE FROM master_pegawai WHERE id = ?', [id]);

    if (username) {
      await pool.query('DELETE FROM users WHERE username = ?', [username]);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Akun fronting berhasil ditutup dan dihapus dari sistem.' 
    });

  } catch (error) {
    console.error("Error Closing Account:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server saat menutup akun.' }, 
      { status: 500 }
    );
  }
}
