// app/api/pegawai/laporan-aduan/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from '@/lib/uploads';

export async function POST(req: Request) {
  let upload: StoredUpload | undefined;
  let committed = false;

  try {
    const formData = await req.formData();

    const target = ((formData.get('target') as string) || 'leader_superadmin').trim();
    const pesan = ((formData.get('pesan') as string) || '').trim();
    const nik = ((formData.get('nik') as string) || '').trim();
    const nama = ((formData.get('nama') as string) || '').trim();
    const nama_leader = ((formData.get('nama_leader') as string) || '').trim();
    const nik_leader = ((formData.get('nik_leader') as string) || '').trim();
    const foto = formData.get('foto');

    if (!pesan || !nik) {
      return NextResponse.json(
        { success: false, message: 'Pesan dan data user tidak valid.' },
        { status: 400 }
      );
    }

    let fileName: string | null = null;

    if (foto instanceof File && foto.size > 0) {
      const extension =
        foto.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
      upload = await storeFileUpload({
        file: foto,
        folder: 'qna',
        localFileName: `laporan-${nik}-${Date.now()}.${extension}`,
      });
      fileName = upload.reference;
    }

    // 1. FORMAT JUDUL, KATEGORI & DESKRIPSI UNTUK qna_materi
    
    const judulLaporan = `Aduan untuk Leader ${nama_leader} dari ${nama} (${nik})`;
    const kategoriLaporan = 'Laporan & Aduan Pegawai';

    const formattedDeskripsi = `Pertanyaan :\n${pesan}\n\nJawaban :\n[Menunggu balasan dari ${
      target === 'leader'
        ? 'Leader'
        : target === 'superadmin'
        ? 'Super Admin'
        : 'Leader / Super Admin'
    }]`;

    // 2. FORMAT DATA NOTIFIKASI
    const tipePesan = 'Laporan & Aduan Pegawai';
    const kontenNotifikasi = `Laporan/Aduan baru dari ${nama} (${nik})${
      nama_leader ? ` | Leader: ${nama_leader}` : ''
    }\n\n${pesan}`;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Simpan laporan ke tabel qna_materi
      await connection.query(
        `INSERT INTO qna_materi (judul, kategori, deskripsi, file_name) 
         VALUES (?, ?, ?, ?)`,
        [judulLaporan, kategoriLaporan, formattedDeskripsi, fileName ?? '']
      );

      // Ambil username milik Leader dari tabel data_leader berdasarkan nama_leader
      let leaderUsername = '';
      if (nama_leader) {
        const [leaderRows]: any = await connection.query(
          `SELECT username
           FROM data_leader
           WHERE LOWER(TRIM(nama_leader)) = LOWER(TRIM(?))
           ORDER BY (username IS NOT NULL AND TRIM(username) != '') DESC, id DESC
           LIMIT 1`,
          [nama_leader]
        );

        if (Array.isArray(leaderRows) && leaderRows[0]?.username) {
          leaderUsername = String(leaderRows[0].username).trim();
        }
      }

      // Prioritaskan username dari data_leader; fallback ke nik_leader / nama_leader jika username di DB masih NULL
      const penerimaLeader = leaderUsername || nik_leader || nama_leader;

      // Insert notifikasi untuk Leader
      if (penerimaLeader) {
        await connection.query(
          `INSERT INTO pesan_notifikasi
           (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
           VALUES (?, ?, ?, ?, ?, 0)`,
          ['Pegawai', penerimaLeader, tipePesan, kontenNotifikasi, fileName]
        );
      }

      // Insert notifikasi untuk Super Admin
      await connection.query(
        `INSERT INTO pesan_notifikasi
         (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
         VALUES (?, 'SUPERADMIN', ?, ?, ?, 0)`,
        ['Pegawai', tipePesan, kontenNotifikasi, fileName]
      );

      await connection.commit();
      committed = true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({
      success: true,
      message:
        'Laporan berhasil dikirim dan notifikasi telah diteruskan ke Leader & Super Admin.',
    });
  } catch (error) {
    if (!committed && upload) await cleanupStoredUploads([upload]);
    console.error('Error saat menyimpan laporan aduan:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Terjadi kesalahan pada server saat memproses laporan.',
      },
      { status: 500 }
    );
  }
}