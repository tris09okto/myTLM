import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const filterBy = searchParams.get('filterBy'); // 'kanwil', 'area', atau 'penempatan'
    const keyword = searchParams.get('keyword') || ''; // Kata kunci pencarian

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username guest tidak ditemukan' }, { status: 400 });
    }

    // 1. Validasi data guest dari tabel users
    const [userRows] = await pool.query(
      `SELECT * FROM users WHERE username = ?`, 
      [username]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Data guest tidak ditemukan' }, { status: 404 });
    }

    const guestData = userRows[0];

    // 2. Query dasar ke master_pegawai (Tampilkan semua data fronting)
    // WHERE 1=1 memudahkan kita menambahkan filter 'AND' secara dinamis di bawahnya
    let frontingQuery = `SELECT nik, nama, kanwil, area, penempatan FROM master_pegawai WHERE 1=1`;
    let frontingParams = [];

    // Jika user memilih filter spesifik (Kanwil/Area/Penempatan) dan mengetik pencarian di UI Guest
    if (filterBy && keyword.trim() !== '') {
      if (['nama', 'kanwil', 'area', 'penempatan'].includes(filterBy)) {
        frontingQuery += ` AND ${filterBy} LIKE ?`;
        frontingParams.push(`%${keyword}%`);
      }
    }

    const [frontingRows] = await pool.query(frontingQuery, frontingParams);

    // Jika tidak ada data fronting yang cocok dengan pencarian
    if (frontingRows.length === 0) {
      return NextResponse.json({ success: true, guest: guestData, totalFronting: 0, team: [] });
    }

    // 3. Ambil data omset dari entri_data_perkiraan_pemasukan yang statusnya Close / Disetujui
    // Menghitung omset secara global untuk di-mapping nanti
    const [omsetRows] = await pool.query(
      `SELECT nik_fronting, nama_fronting, SUM(up_pengajuan) as total_omset 
       FROM entri_data_perkiraan_pemasukan 
       WHERE status LIKE '%Close%' OR status = 'Disetujui'
       GROUP BY nik_fronting, nama_fronting`
    );

    // 4. Petakan (Mapping) omset ke dalam data fronting
    const omsetMap = {};
    omsetRows.forEach(row => {
      // Menyimpan omset ke object, menggunakan NIK atau Nama sebagai kunci
      if (row.nik_fronting) omsetMap[row.nik_fronting] = row.total_omset;
      if (row.nama_fronting) omsetMap[row.nama_fronting] = row.total_omset;
    });

    // Gabungkan data profil dari master_pegawai dengan total omsetnya
    const teamWithOmset = frontingRows.map(fronting => ({
      ...fronting,
      omset: omsetMap[fronting.nik] || omsetMap[fronting.nama] || 0
    }));

    // Hitung jumlah unik untuk kanwil, area, dan penempatan dari data fronting
    const totalKanwil = new Set(frontingRows.map(f => f.kanwil).filter(Boolean)).size;
    const totalArea = new Set(frontingRows.map(f => f.area).filter(Boolean)).size;
    const totalPenempatan = new Set(frontingRows.map(f => f.penempatan).filter(Boolean)).size;

    return NextResponse.json({
      success: true,
      guest: guestData,
      totalFronting: frontingRows.length,
      totalKanwil,           // Tambahkan ini
      totalArea,             // Tambahkan ini
      totalPenempatan,       // Tambahkan ini
      team: teamWithOmset
    });

  } catch (error) {
    console.error('Error guest dashboard:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}