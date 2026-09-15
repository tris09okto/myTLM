import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Pastikan path koneksi database ini benar

export async function GET(request) {
  try {
    // 1. Tangkap parameter pencarian dari URL (contoh: /api/pegawai/get-all-pegawai?search=budi)
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search') || '';
    // 2. BUAT PERIODE SECARA OTOMATIS BERDASARKAN WAKTU SAAT INI
    // Contoh format yang dihasilkan: "2026-08" (Tahun-Bulan)
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 karena getMonth dimulai dari 0
    const periodeSaatIni = `${year}-${month}`; 

    // Alternatif jika Anda ingin menangkapnya dari parameter URL frontend:
    // const { searchParams } = new URL(request.url);
    // const periodeSaatIni = searchParams.get('periode') || `${year}-${month}`;

    let query = `
      SELECT 
        combined.id, 
        combined.nama, 
        combined.nik, 
        combined.jenis_pegawai, 
        combined.nama_bank, 
        combined.norek,
        combined.area,       
        combined.leader,     
        tg.estimasi,
        tg.estimasi_shared,
        tg.slip_name,
        tg.slip_sent
      FROM (
        -- 1. DATA PEGAWAI FRONTING (Dari master_pegawai)
        SELECT 
          id, nama, nik, jenis_pegawai, nama_bank, norek, area, leader
        FROM master_pegawai
        
        UNION ALL
        
        -- 2. DATA PEGAWAI NON-FRONTING
        SELECT 
          id, nama, nik, 'Non-Fronting' as jenis_pegawai, NULL as nama_bank, NULL as norek, area_penempatan as area, supervisor as leader
        FROM data_non_fronting
        
        UNION ALL
        
        -- 3. DATA LEADER
        SELECT 
          id, nama_leader as nama, username as nik, 'Leader' as jenis_pegawai, NULL as nama_bank, NULL as norek, area, NULL as leader
        FROM data_leader
      ) AS combined
      LEFT JOIN transaksi_gaji tg 
        ON combined.id = tg.id_pegawai AND tg.periode = ?
    `;

    const queryParams = [periodeSaatIni];

    // Jika ada teks pencarian, tambahkan kondisi WHERE ... LIKE ...
    if (searchQuery.trim() !== '') {
      query += ` WHERE combined.nama LIKE ? OR combined.nik LIKE ?`;
      queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    // Urutkan berdasarkan nama agar rapi di frontend
    query += ` ORDER BY combined.nama ASC`;

    const [rows] = await pool.query(query, queryParams);

    return NextResponse.json({ success: true, data: rows });

  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data pegawai' }, 
      { status: 500 }
    );
  }
}