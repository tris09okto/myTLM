import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/*export async function GET(request: Request) {
  try {

    const { searchParams } = new URL(request.url);
    // Hapus spasi kosong yang mungkin tidak sengaja terbawa pada NIK
    const nik = searchParams.get('nik')?.trim();

    if (!nik) {
      return NextResponse.json({ error: 'NIK diperlukan' }, { status: 400 });
    }

    // 1. Cek jabatan pegawai dari tabel users berdasarkan NIK (atau field username/name yang merepresentasikan NIK)
    const [userRows] = await pool.query(
      `SELECT jabatan FROM users WHERE username = ? LIMIT 1`,
      [nik, nik, nik]
    ) as [any[], any];

    let isFronting = true;
    if (userRows.length > 0) {
      const jabatanUser = userRows[0].jabatan?.toLowerCase() || '';
      // Jika di jabatan ada kata 'fronting', maka true. Jika tidak, false.
      isFronting = jabatanUser.includes('fronting');
    } else {
      // 2. FALLBACK: Jika tidak ketemu di users, cek langsung ke tabel data_non_fronting
      const [nonFrontingRows] = await pool.query(
        `SELECT id FROM data_non_fronting WHERE nik = ? LIMIT 1`,
        [nik]
      ) as [any[], any];

      if (nonFrontingRows.length > 0) {
        isFronting = false; // Dipastikan non-fronting karena terdaftar di data non-fronting
      }
    }

    // 2. Tentukan flag broadcast yang berhak diterima pegawai ini
    const broadcastTarget = isFronting ? 'ALL_FRONTING' : 'ALL_NON_FRONTING';
    
    // 3. Ambil pesan: Pesan personal, Broadcast Umum ('ALL'), atau Broadcast Kategori (Fronting/Non-Fronting)
    const [notifRows] = await pool.query(
      `SELECT * FROM pesan_notifikasi 
       WHERE penerima_nik = ? 
          OR penerima_nik = 'ALL' 
          OR penerima_nik = ? 
       ORDER BY created_at DESC`,
      [nik, broadcastTarget]
    );

    return NextResponse.json(notifRows);
    
  } catch (error) {
    console.error('Fetch Notifikasi Error:', error);
    return NextResponse.json({ error: 'Gagal mengambil notifikasi' }, { status: 500 });
  }
}*/
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nik = searchParams.get('nik')?.trim();
    
    if (!nik) {
      return NextResponse.json({ success: false, message: "NIK tidak ditemukan." }, { status: 400 });
    }

    // 1. Cek langsung ke tabel users berdasarkan kolom username (karena NIK disimpan di kolom username)
    let isFronting = true; // Default asumsikan fronting

    // 1. Cek jabatan pegawai dari tabel users berdasarkan username (atau NIK)
    const [userRows] = await pool.execute(
      'SELECT jabatan FROM users WHERE username = ? LIMIT 1',
      [nik]
    );

    if (Array.isArray(userRows) && userRows.length > 0) {
      const jabatanUser = (userRows[0] as any).jabatan?.toLowerCase() || '';
      // Jika teks pada kolom jabatan mengandung kata 'fronting', maka true. 
      // Jika isinya jabatan lain (misal: back office, admin, spv, dll), maka false (non-fronting).
      isFronting = jabatanUser.includes('fronting');
    } else {
      // Jika NIK tidak ditemukan di tabel users, secara aman kita anggap non-fronting atau cek tabel lain
      isFronting = false;
    }

    // 2. Tentukan target broadcast yang berhak diterima
    // Jika fronting -> 'ALL_FRONTING', Jika bukan fronting -> 'ALL_NON_FRONTING'
    const targetBroadcast = isFronting ? 'ALL_FRONTING' : 'ALL_NON_FRONTING';
    // Ambil notifikasi untuk NIK ybs, broadcast umum ('ALL'), atau broadcast sesuai divisinya
    const query = `
      SELECT * FROM pesan_notifikasi 
      WHERE penerima_nik = ? 
         OR penerima_nik = 'ALL' 
         OR penerima_nik = ? 
      ORDER BY created_at DESC
    `;
    const [notifRows] = await pool.execute(query, [nik, targetBroadcast]);

    return NextResponse.json(notifRows, { status: 200 });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ success: false, message: "Gagal memuat notifikasi." }, { status: 500 });
  }
}