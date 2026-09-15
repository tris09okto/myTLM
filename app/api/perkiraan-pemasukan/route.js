import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan dengan koneksi database Anda

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const nik = searchParams.get('nik'); // Untuk Pegawai
    const username = searchParams.get('username'); // Untuk Leader

    let query = `SELECT * FROM entri_data_perkiraan_pemasukan ORDER BY created_at DESC`;
    let queryParams = [];

    // Filter khusus pegawai berdasarkan nik_fronting
    if (role === 'pegawai' && nik) {
      query = `SELECT * FROM entri_data_perkiraan_pemasukan WHERE nik_fronting = ? ORDER BY created_at DESC`;
      queryParams.push(nik);
    } // Filter Khusus Leader berdasarkan Area dari tabel data_leader
    else if (role === 'leader' && username) {
      // 1. Cari area milik leader yang sedang login
      const [leaderRows] = await pool.query(
        `SELECT area FROM data_leader WHERE username = ?`, 
        [username]
      );

      if (leaderRows.length > 0 && leaderRows[0].area) {
        let areaArray = [];
        try {
          // Parse string JSON area menjadi Array
          areaArray = JSON.parse(leaderRows[0].area);
        } catch (e) {
          // Fallback jika format teks biasa bukan JSON
          areaArray = [leaderRows[0].area];
        }

        if (areaArray.length > 0) {
          // 2. Buat parameter dinamis untuk query "IN ( ?, ?, ? )"
          const placeholders = areaArray.map(() => '?').join(',');
          query = `SELECT * FROM entri_data_perkiraan_pemasukan WHERE area IN (${placeholders}) ORDER BY created_at DESC`;
          queryParams = [...areaArray];
        } else {
          // Return kosong jika array area kosong
          return NextResponse.json({ success: true, data: [] });
        }
      } else {
        // Return kosong jika leader tidak memiliki area
        return NextResponse.json({ success: true, data: [] });
      }
    }

    const [rows] = await pool.query(query, queryParams);
    
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching data perkiraan pemasukan:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}