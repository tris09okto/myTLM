import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username diperlukan' }, { status: 400 });
    }

    // 1. Ambil data supervisor berdasarkan username dari tabel data_leader
    const [spvRows] = await pool.query(
      `SELECT * FROM data_non_fronting WHERE username = ? and jabatan = 'supervisor' LIMIT 1`,
      [username]
    );

    let spvData = spvRows[0];

    // Fallback jika tidak ditemukan di data_leader, cek ke tabel users
    if (!spvData) {
      const [userRows] = await pool.query(
        `SELECT * FROM users WHERE username = ? LIMIT 1`,
        [username]
      );
      if (userRows.length === 0) {
        return NextResponse.json({ success: false, error: 'Data Supervisor tidak ditemukan' }, { status: 404 });
      }
      spvData = { nama_leader: userRows[0].username, area: '-' };
    }

    const supervisorName = spvData.nama_leader || spvData.username;

    // 2. Ambil daftar pegawai non-fronting yang berada di bawah pengawasan supervisor ini
    // Menyesuaikan dengan kolom relasi leader/supervisor di tabel data_non_fronting Anda
    const [teamRows] = await pool.query(
      `SELECT * FROM data_non_fronting WHERE supervisor = ?`,
      [supervisorName]
    );

    return NextResponse.json({
      success: true,
      spv: spvData,
      team: teamRows
    });

  } catch (error) {
    console.error('Error fetching SPV dashboard API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}