import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import {pool} from '@/lib/db'; // Sesuaikan path koneksi database Anda

export async function POST(request) {
  try {
    const { id } = await request.json();

    let username = "";

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID Akun tidak valid!' }, { status: 400 });
    }

    // 1. Ambil data file lama untuk dihapus dari folder public/uploads (opsional tapi disarankan)
    const [rows] = await pool.query('SELECT idcard_file, st_file, username, password FROM master_pegawai WHERE id = ?', [id]);
    
    if (rows.length > 0) {
      const userData = rows[0];

      username = userData.username;

      // Hapus file ID Card jika ada
      if (userData.idcard_file) {
        try {
          await unlink(path.join(process.cwd(), 'public/uploads', userData.idcard_file));
        } catch (e) {
          console.error("Gagal menghapus file ID Card fisik:", e);
        }
      }

      // Hapus file Surat Tugas jika ada
      if (userData.st_file) {
        try {
          await unlink(path.join(process.cwd(), 'public/uploads', userData.st_file));
        } catch (e) {
          console.error("Gagal menghapus file Surat Tugas fisik:", e);
        }
      }
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