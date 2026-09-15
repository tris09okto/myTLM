import { NextResponse } from 'next/server';
// Sesuaikan path import koneksi database Anda
import { pool } from '@/lib/db'; 

export async function GET(request: Request) {
  try {
    // 1. Ambil parameter URL (query string)
    const { searchParams } = new URL(request.url);
    const leaderName = searchParams.get('leaderName');

    // 2. Validasi apakah nama leader dikirim dari frontend
    if (!leaderName) {
      return NextResponse.json(
        { error: 'Parameter leaderName diwajibkan' },
        { status: 400 }
      );
    }

    // 3. Siapkan Query Database
    // Kita filter berdasarkan jenis_pegawai = 'fronting' DAN leader = nama leader yang dipilih
    const query = `
      SELECT id, nama, nik, kanwil, area, penempatan, nowa 
      FROM master_pegawai 
      WHERE jenis_pegawai = 'fronting' AND leader = ?
    `;

    // 4. Eksekusi Query menggunakan parameter binding (?) untuk mencegah SQL Injection
    // Tambahkan ": any" pada [rows] jika Anda mendapat error TypeScript terkait RowDataPacket
    const [rows]: any = await pool.query(query, [leaderName]);

    // 5. Kembalikan data dalam format JSON ke Client
    return NextResponse.json(rows);

  } catch (error) {
    // Tangkap error jika terjadi masalah pada koneksi/query database
    console.error('API Error (Fetch Fronting):', error);
    
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal saat mengambil data fronting.' },
      { status: 500 }
    );
  }
}