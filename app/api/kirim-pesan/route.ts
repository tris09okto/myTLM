import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const pengirimRole = formData.get('pengirimRole') as string; 
    let nikTujuan = formData.get('nikTujuan') as string; 
    const tipe = formData.get('tipe') as string;
    const konten = formData.get('konten') as string;
    const fileLampiran = formData.get('file_lampiran');

    let safeFileName = null;

    if (fileLampiran && fileLampiran instanceof File && fileLampiran.size > 0) {
      const isDirekturTarget = pengirimRole?.toLowerCase() === 'direktur';
      const subFolder = isDirekturTarget ? 'public/uploads/direktur' : 'public/uploads/admin';
      const uploadDir = path.join(process.cwd(), subFolder);
      
      await fs.mkdir(uploadDir, { recursive: true });

      const prefix = isDirekturTarget ? 'instruksi_' : 'lampiran_';
      safeFileName = `${prefix}${Date.now()}_${fileLampiran.name.replace(/\s+/g, '_')}`;
      const filePath = path.join(uploadDir, safeFileName);

      const bytes = await fileLampiran.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(filePath, buffer);
    }

    // --- PENANGANAN KHUSUS BALASAN LAPORAN/ADUAN ---
    const isBalasanLaporan = 
      (pengirimRole?.toUpperCase() === 'MO' || pengirimRole?.toLowerCase() === 'supervisor') && 
      (tipe?.toLowerCase().includes('laporan') || tipe?.toLowerCase().includes('aduan') || tipe?.toLowerCase().includes('balasan'));

    let targetNik = nikTujuan;

    // Kumpulan penanda Broadcast yang tidak boleh dicari di tabel laporan_aduan
    const isBroadcastFlag = ['ALL', 'ALL_FRONTING', 'ALL_NON_FRONTING', 'HRD', 'MO', 'DIREKTUR', 'KEUANGAN'].includes(nikTujuan?.toUpperCase());

    if (isBalasanLaporan && nikTujuan && !isBroadcastFlag) {
      // Cari data laporan berdasarkan NIK atau ID yang dikirim untuk memastikan NIK valid & memperbarui laporan_aduan
      const [laporanRows] = await pool.query(
        `SELECT id, nik, pesan FROM laporan_aduan WHERE nik = ? OR id = ? ORDER BY created_at DESC LIMIT 1`,
        [nikTujuan, nikTujuan]
      ) as [any[], any];

      if (laporanRows.length > 0) {
        const laporan = laporanRows[0];
        targetNik = laporan.nik; // PAKSA targetNik menggunakan NIK asli dari tabel laporan_aduan
        
        const currentPesan = laporan.pesan || '';
        const updatedPesan = currentPesan.includes('\n\nJawaban :\n')
          ? currentPesan.split('\n\nJawaban :\n')[0] + `\n\nJawaban :\n${konten}`
          : currentPesan + `\n\nJawaban :\n${konten}`;

        // Update teks jawaban di laporan_aduan
        await pool.query(
          `UPDATE laporan_aduan SET pesan = ? WHERE id = ?`,
          [updatedPesan, laporan.id]
        );
      }
    }

    // --- LOGIKA PENYIMPANAN NOTIFIKASI KE DATABASE ---
    if (pengirimRole?.toLowerCase() === 'direktur' && nikTujuan === 'ALL') {
      const targetDivisions = ['MO', 'HRD', 'Keuangan'];
      for (const divisi of targetDivisions) {
        await pool.query(
          `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read) 
           VALUES (?, ?, ?, ?, ?, 0)`,
          [pengirimRole, divisi, tipe, konten, safeFileName]
        );
      }
    } else {
      // Menyimpan pesan dengan penerima_nik yang sudah dipastikan berupa NIK pegawai yang benar
      await pool.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read) 
         VALUES (?, ?, ?, ?, ?, 0)`,
        [pengirimRole, targetNik || 'ALL', tipe, konten, safeFileName]
      );
    }

    return NextResponse.json({ success: true, message: 'Pesan/Balasan berhasil dikirim ke pegawai.' });

  } catch (error) {
    console.error("Gagal kirim pesan:", error);
    return NextResponse.json({ success: false, message: 'Kesalahan internal server' }, { status: 500 });
  }
}