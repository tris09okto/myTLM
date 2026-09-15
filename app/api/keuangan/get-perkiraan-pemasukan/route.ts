import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan dengan konfigurasi koneksi database Anda

export async function GET() {
  try {
    // Contoh query mengambil seluruh data dari tabel entri_data_perkiraan_pemasukan
    const [rows]: any = await pool.query(
      'SELECT * FROM entri_data_perkiraan_pemasukan ORDER BY id'
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching perkiraan pemasukan:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}