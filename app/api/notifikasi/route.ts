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
    
    // Parameter ini berasal dari frontend (bisa berupa username bebas, nama, atau NIK 'TLM...')
    const paramInput = searchParams.get('nik')?.trim();

    if (!paramInput) {
      return NextResponse.json({ success: false, message: "Parameter identitas tidak ditemukan." }, { status: 400 });
    }

    let isFronting = true; // Default asumsi awal
    let actualNik = paramInput; // Untuk menyimpan NIK asli jika yang dipakai login adalah username bebas

    // 1. CEK NON-FRONTING TERLEBIH DAHULU
    // Karena username bebas, kita cek apakah input cocok dengan username atau nik di data_non_fronting
    try {
      const [nfRows] = await pool.execute(
        'SELECT nik FROM data_non_fronting WHERE username = ? OR nik = ? LIMIT 1',
        [paramInput, paramInput]
      );
      
      if (Array.isArray(nfRows) && nfRows.length > 0) {
        isFronting = false; // Pegawai dipastikan NON-FRONTING
        if ((nfRows[0] as any).nik) {
           actualNik = (nfRows[0] as any).nik; // Simpan NIK aslinya
        }
      }
    } catch (e) {
      console.error("Error cek data_non_fronting:", e);
    }

    // 2. JIKA BUKAN NON-FRONTING, CEK FRONTING DI MASTER PEGAWAI
    if (isFronting) {
      try {
        const [frontingRows] = await pool.execute(
          'SELECT nik FROM master_pegawai WHERE nik = ? OR nama = ? LIMIT 1',
          [paramInput, paramInput]
        );
        
        if (Array.isArray(frontingRows) && frontingRows.length > 0) {
          isFronting = true; // Pegawai dipastikan FRONTING
          if ((frontingRows[0] as any).nik) {
             actualNik = (frontingRows[0] as any).nik;
          }
        }
      } catch (e) {
        console.error("Error cek master_pegawai:", e);
      }
    }

    // 3. TENTUKAN TARGET BROADCAST
    const targetBroadcast = isFronting ? 'ALL_FRONTING' : 'ALL_NON_FRONTING';

    // 4. AMBIL NOTIFIKASI
    // Mengambil notif untuk: 
    // - username saat login (paramInput)
    // - NIK aslinya (actualNik)
    // - Broadcast ALL
    // - Broadcast Kategori (ALL_FRONTING / ALL_NON_FRONTING)
    const query = `
      SELECT * FROM pesan_notifikasi 
      WHERE penerima_nik = ? 
         OR penerima_nik = ?
         OR penerima_nik = 'ALL' 
         OR penerima_nik = ? 
      ORDER BY created_at DESC
    `;
    
    const [notifRows] = await pool.execute(query, [paramInput, actualNik, targetBroadcast]);

    return NextResponse.json(notifRows, { status: 200 });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ success: false, message: "Gagal memuat notifikasi." }, { status: 500 });
  }
}