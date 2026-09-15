import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    const keterangan = formData.get('keterangan') as string;
    const spvUsername = formData.get('spv_username') as string;
    const spvNama = formData.get('spv_nama') as string;
    const foto = formData.get('foto') as File | null;

    if (!keterangan || !spvUsername) {
      return NextResponse.json(
        { success: false, message: 'Keterangan survey dan username SPV tidak boleh kosong.' }, 
        { status: 400 }
      );
    }

    let fileName: string | null = null;

    // 1. Proses Upload File Foto Survey jika ada
    if (foto && foto.size > 0) {
      const bytes = await foto.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const safeOriginalName = foto.name.replace(/\s+/g, '_');
      fileName = `survey_${spvUsername}_${Date.now()}_${safeOriginalName}`;
      const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'spv-survey-kunjungan', fileName);

      await writeFile(uploadPath, buffer);
    }

    // 2. Simpan data ke tabel survey_kunjungan
    await pool.query(
      `INSERT INTO survey_kunjungan (spv_username, spv_nama, keterangan, foto, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [spvUsername, spvNama, keterangan, fileName]
    );

    // 3. Cari semua user Admin MO dan HRD di tabel users / data_non_fronting
    const [targetUsers] = await pool.query(
      `SELECT jabatan FROM users 
       WHERE LOWER(jabatan) LIKE '%mo%' 
          OR LOWER(jabatan) LIKE '%hrd%'`
    ) as [any[], any];

    // 4. Kirim notifikasi otomatis ke tabel pesan_notifikasi untuk setiap Admin MO & HRD
    if (targetUsers && targetUsers.length > 0) {
      const kontenNotif = `[Survey Kunjungan] Dari SPV: ${spvNama} (${spvUsername}). Keterangan: "${keterangan}"`;
      const tipePesan = 'Survey Kunjungan Lapangan';

      for (const user of targetUsers) {
        await pool.query(
          `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, 0, NOW())`,
          [spvUsername, user.jabatan, tipePesan, kontenNotif, fileName]
        );
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Survey kunjungan berhasil dikirim dan notifikasi telah diteruskan ke Admin MO dan HRD.' 
      }, 
      { status: 200 }
    );

  } catch (error) {
    console.error('Database/Server Error pada /api/spv/survey-kunjungan:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan internal pada server.' }, 
      { status: 500 }
    );
  }
}