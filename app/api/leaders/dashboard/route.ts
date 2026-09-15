import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username tidak diberikan' }, { status: 400 });
  }

  try {
    // 1. Validasi Akun Leader
    const [userRows] = await pool.query(
      'SELECT username, jabatan FROM users WHERE username = ?',
      [username]
    ) as [any, any];

    if (userRows.length === 0 || !userRows[0].jabatan?.toLowerCase().includes('leader')) {
      return NextResponse.json({ error: 'Akses Ditolak: Bukan akun Leader' }, { status: 403 });
    }

    // 2. Tarik Data Profil Leader
    const [leaderRows] = await pool.query(
      `SELECT id, nama_leader, kanwil, area, penempatan, email, username, idcard_file 
      FROM data_leader 
      WHERE username = ?`, 
      [username]
    ) as [any, any];

    if (leaderRows.length === 0) {
      return NextResponse.json({ error: 'Profil leader tidak ditemukan' }, { status: 404 });
    }
    
    const namaLeader = leaderRows[0].nama_leader;

    // 3. Tarik Data Tim & Total Closing Masing-masing Anggota
    const [teamRows] = await pool.query(
      `SELECT 
         p.nama, p.area, p.penempatan, p.nik,
         COALESCE(SUM(e.up_pengajuan), 0) as total_closing_member
       FROM master_pegawai p
       LEFT JOIN entri_data_perkiraan_pemasukan e 
         ON p.nik = e.nik_fronting AND e.status LIKE '%Close'
       WHERE p.leader = ?
       GROUP BY p.nik, p.nama, p.area, p.penempatan`,
      [namaLeader]
    ) as [any, any];

    // 4. Tarik Akumulasi Total Nominal Closing Seluruh Tim
    const [closingTotalRows] = await pool.query(
      `SELECT COALESCE(SUM(e.up_pengajuan), 0) as grand_total_closing 
       FROM entri_data_perkiraan_pemasukan e 
       JOIN master_pegawai p ON e.nik_fronting = p.nik 
       WHERE p.leader = ? AND e.status LIKE '%Close'`,
      [namaLeader]
    ) as [any, any];

    return NextResponse.json({
      leader: leaderRows[0],
      team: teamRows,
      totalClosing: closingTotalRows[0]?.grand_total_closing || 0
    }, { status: 200 });

  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server' }, { status: 500 });
  }
}