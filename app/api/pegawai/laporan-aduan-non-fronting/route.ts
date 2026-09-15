import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const target = formData.get('target') as string || 'admin_mo_spv';
    const pesan = formData.get('pesan') as string;
    const nik = formData.get('nik') as string;
    const nama = formData.get('nama') as string;
    const foto = formData.get('foto') as File | null;

    if (!pesan || !nik) {
      return NextResponse.json(
        { success: false, message: 'Pesan laporan dan NIK tidak boleh kosong.' }, 
        { status: 400 }
      );
    }

    let fileName: string | null = null;

    // 1. Proses Upload File Foto jika ada
    if (foto && foto.size > 0) {
      const bytes = await foto.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const safeOriginalName = foto.name.replace(/\s+/g, '_');
      fileName = `laporan_${nik}_${Date.now()}_${safeOriginalName}`;
      const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'non-fronting', fileName);

      await writeFile(uploadPath, buffer);
    }

    // 2. Simpan data laporan ke dalam tabel laporan_aduan
    await pool.query(
      `INSERT INTO laporan_aduan (nik, nama, target, pesan, foto, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [nik, nama, target, pesan, fileName]
    );

    // 3. Ambil nama supervisor langsung dari kolom 'supervisor' di tabel data_non_fronting berdasarkan NIK pegawai
    const [pegawaiRows] = await pool.query(
      `SELECT supervisor FROM data_non_fronting WHERE nik = ?`,
      [nik]
    ) as [any[], any];

    const namaSupervisor = pegawaiRows[0]?.supervisor;

    // 4. Cari username login dari supervisor tersebut untuk dikirimi notifikasi
    let penerimaUsername: string | null = null;
    if (namaSupervisor) {
      const [userRows] = await pool.query(
        `SELECT username FROM data_non_fronting WHERE nama = ? OR username = ?`,
        [namaSupervisor, namaSupervisor]
      ) as [any[], any];

      if (userRows.length > 0) {
        penerimaUsername = userRows[0].username;
      }
    }

    // 5. Kirim notifikasi KE TABEL pesan_notifikasi HANYA kepada Supervisor yang bersangkutan
    if (penerimaUsername) {
      const kontenNotif = `[Laporan Pegawai] Dari: ${nama} (${nik}). Pesan: "${pesan}"`;
      const tipePesan = 'Laporan Pegawai';
      const pengirimRole = nik;

      await pool.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
        [pengirimRole, penerimaUsername, tipePesan, kontenNotif, fileName]
      );
    }

    // 3. Otomatis Kirim Notifikasi ke Admin MO dan Supervisor (SPV)
    if (target === 'admin_mo_spv') {
      // Cari username / penerima dari user yang memiliki jabatan Admin MO atau Supervisor di database
      const [targetUsers] = await pool.query(
        `SELECT username FROM users 
         WHERE LOWER(jabatan) LIKE '%mo%'`,
      ) as [any[], any];

      if (targetUsers && targetUsers.length > 0) {
        const kontenNotif = `[Laporan Baru] Dari Pegawai: ${nama} (${nik}). Pesan: "${pesan}"`;
        const tipePesan = 'Laporan Pegawai';

        // Masukkan notifikasi ke masing-masing Admin MO dan Supervisor yang ditemukan 
        // Menggunakan tabel dan kolom yang sesuai dengan struktur pesan_notifikasi Anda
        for (const user of targetUsers) {
            const user_role = user.username;
        
            if (user_role === 'adminmo') {
                await pool.query(
                `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, NOW())`,
                [nik, 'MO', tipePesan, kontenNotif, fileName]
                );
            }
            
        }
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Laporan berhasil dikirim dan notifikasi telah diteruskan ke Supervisor & Admin MO.' 
      }, 
      { status: 200 }
    );

  } catch (error) {
    console.error('Database/Server Error pada /api/pegawai/laporan-aduan-non-fronting:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan internal pada server.' }, 
      { status: 500 }
    );
  }
}