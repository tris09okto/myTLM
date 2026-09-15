import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request) {
  let connection;
  try {
    // Buat koneksi ke database db_mytlm
    // Sesuaikan host, user, password, dan database dengan konfigurasi lokal Anda
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'mytlm_user',
      password: process.env.DB_PASSWORD || 'mytlm2026!@',
      database: process.env.DB_NAME || 'db_mytlm',
    });

    // Mulai proses truncate (menghapus data & mereset ID auto-increment)
    await connection.execute('TRUNCATE TABLE entri_data_perkiraan_pemasukan');
    await connection.execute('TRUNCATE TABLE transaksi_gaji');

    // Tutup koneksi database
    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Data pada tabel entri_data_perkiraan_pemasukan dan transaksi_gaji berhasil dikosongkan!',
    }, { status: 200 });

  } catch (error) {
    console.error('Error saat mereset tabel:', error);
    
    // Pastikan koneksi ditutup jika terjadi error
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }

    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server: ' + error.message,
    }, { status: 500 });
  }
}