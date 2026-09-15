import AdminDashboardClient from '../AdminDashboardClient';

// 1. IMPORT KONEKSI DB DARI FILE YANG KITA BUAT DI LANGKAH 2
// Sesuaikan path-nya, @/lib/db atau ../../lib/db tergantung struktur folder Anda
import {pool} from '@/lib/db'; 

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const session = await getServerSession(authOptions);
let loggedInJabatan = 'UMUM'; // fallback

if (session?.user?.name) { // 'name' often stores the username in standard NextAuth, or session.user.username if customized
   const [userRows]: any = await pool.query('SELECT jabatan FROM users WHERE username = ? LIMIT 1', [session.user.name]);
   if (userRows.length > 0) {
      loggedInJabatan = userRows[0].jabatan;
   }
}

export default async function AdminPage() {
  
  try {

    // 1. Ambil Sesi Login Aktif
    const session = await getServerSession(authOptions);
    let loggedInJabatan = 'admin'; // Default fallback

    // 2. Query ke tabel users berdasarkan username yang login
    if (session?.user?.name) {
      // Mengambil kolom jabatan dari tabel users dengan pencocokan username
      const [userRows]: any = await pool.query(
        'SELECT jabatan FROM users WHERE username = ? LIMIT 1', 
        [session.user.name]
      );
      
      if (userRows.length > 0) {
        loggedInJabatan = userRows[0].jabatan;
      }
    }

    const [rowsWilayah]: any = await pool.query('SELECT DISTINCT kanwil FROM master_wilayah');
    const areaList = rowsWilayah.map((r: any) => r.kanwil);
    
    const [rowsFronting]: any = await pool.query(
      "SELECT COUNT(*) as total FROM master_pegawai WHERE jenis_pegawai = 'fronting' AND LOWER(nik) NOT LIKE '%test%'"
    );
    const frontingCount = Number(rowsFronting[0].total) || 0;

      // 2. TAMBAHKAN: Ambil data jumlah dari tabel data_non_fronting berdasarkan unit_kerja
    const [nonFrontingRows] = await pool.query(
      `SELECT unit_kerja, COUNT(*) as total FROM data_non_fronting GROUP BY unit_kerja`
    ) as [any[], any];

    // Inisialisasi counter 0
    const counts = {
      obCs: 0,
      security: 0,
      driver: 0,
      teknisi: 0,
      gondola: 0
    };

    // Cocokkan hasil query dengan kategori
    nonFrontingRows.forEach((row) => {
      const unit = row.unit_kerja?.toLowerCase() || '';
      if (unit.includes('ob') || unit.includes('cs') || unit.includes('cleaning')) {
        counts.obCs += row.total;
      } else if (unit.includes('security') || unit.includes('satpam')) {
        counts.security += row.total;
      } else if (unit.includes('driver') || unit.includes('supir')) {
        counts.driver += row.total;
      } else if (unit.includes('teknisi')) {
        counts.teknisi += row.total;
      } else if (unit.includes('gondola')) {
        counts.gondola += row.total;
      }
    });

    const [rowsLeader]: any = await pool.query(
      'SELECT id, nama_leader, kanwil, area, penempatan FROM data_leader'
    );

    const [rowsJabatan]: any = await pool.query('SELECT id, jabatan FROM master_jabatan');

    const dataJabatan = rowsJabatan.map((r: any) => r.jabatan);
    
    // Fetch all employees for the message destination dropdown
    const [rowsPegawai]: any = await pool.query('SELECT nama, nik FROM master_pegawai');
    
    const listPegawai = rowsPegawai.map((r: any) => ({ nama: r.nama, nik: r.nik }));
    
    const dataLeaders = rowsLeader.map((r: any) => ({
      id: r.id,
      nama_leader: r.nama_leader,
      kanwil: r.kanwil,
      area: r.area,
      penempatan: r.penempatan
    }));

    // BARU: Ambil seluruh data master_wilayah untuk relasi cascading dropdown
    const [rowsMasterWilayah]: any = await pool.query(
      'SELECT kanwil, area, penempatan FROM master_wilayah WHERE kanwil IS NOT NULL AND area IS NOT NULL AND penempatan IS NOT NULL'
    );

    return (
      <AdminDashboardClient 
        areaList={areaList} 
        frontingCount={frontingCount} 
        nonFrontingCounts={counts} // 3. KIRIMKAN HASIL PERHITUNGAN KE KOMPONEN CLIENT
        dataLeaders={dataLeaders}
        masterWilayah={rowsMasterWilayah} // Kirim master wilayah utuh ke client
        dataJabatan={rowsJabatan}
        listPegawai={listPegawai}
        // BARU: Kirim jabatan asli user yang login ke Client
        loggedInJabatan={loggedInJabatan}
      />
    );

  } catch (error) {
    console.error("DATABASE ERROR:", error);
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="bg-red-50 p-6 rounded-lg border border-red-200 shadow-sm text-center">
          <h2 className="text-red-700 font-bold mb-2 text-lg">Gagal Terhubung ke Database</h2>
          <p className="text-red-600 text-sm">Periksa console/terminal untuk detail error.</p>
        </div>
      </div>
    );
  }
  
}