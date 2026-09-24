import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  let connection;
  try {
    connection = await pool.getConnection();

    // Mulai proses truncate (menghapus data & mereset ID auto-increment)
    await connection.execute('TRUNCATE TABLE entri_data_perkiraan_pemasukan');
    await connection.execute('TRUNCATE TABLE transaksi_gaji');

    // Tutup koneksi database
    connection.release();
    connection = null;

    return NextResponse.json({
      success: true,
      message: 'Data pada tabel entri_data_perkiraan_pemasukan dan transaksi_gaji berhasil dikosongkan!',
    }, { status: 200 });

  } catch (error) {
    console.error('Error saat mereset tabel:', error);
    
    // Pastikan koneksi ditutup jika terjadi error
    if (connection) {
      connection.release();
    }

    return NextResponse.json({
      success: false,
      message: 'Terjadi kesalahan pada server: ' + error.message,
    }, { status: 500 });
  }
}
