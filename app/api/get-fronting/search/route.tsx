import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Sesuaikan path koneksi database Anda

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const kanwil = searchParams.get('kanwil');
    const area = searchParams.get('area');
    const penempatan = searchParams.get('penempatan');

    // Base Query
    let query = `
      SELECT 
        p.*, 
        t.estimasi 
      FROM master_pegawai p
      LEFT JOIN transaksi_gaji t ON p.id = t.id_pegawai
      WHERE p.jenis_pegawai = 'fronting'
    `;
    
    const queryValues: any[] = [];

    // Filter dinamis menggunakan '=' untuk dropdown
    if (kanwil) {
      query += ` AND kanwil = ?`;
      queryValues.push(kanwil);
    }
    
    if (area) {
      query += ` AND area = ?`;
      queryValues.push(area);
    }
    
    if (penempatan) {
      query += ` AND penempatan = ?`;
      queryValues.push(penempatan);
    }

    const [rows]: any = await pool.query(query, queryValues);

    return NextResponse.json(rows);

  } catch (error) {
    // Log error ini akan muncul di Terminal (bukan browser) untuk debugging
    console.error('API Error (/api/get-fronting/search):', error);
    
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal saat mencari data fronting.' },
      { status: 500 }
    );
  }
}