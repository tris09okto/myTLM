import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req) {
  try {
    // 1. Ekstrak data dari FormData (bukan JSON karena ada file foto)
    const formData = await req.formData();
    const nik = formData.get("nik");
    const nama = formData.get("nama");
    const unit_kerja = formData.get("unit_kerja");
    const jenis_absen = formData.get("jenis_absen"); // 'Masuk' atau 'Pulang'
    const latitude = formData.get("latitude");
    const longitude = formData.get("longitude");
    const lokasi_alamat = formData.get("lokasi_alamat");
    const foto_absen = formData.get("foto_absen"); // File gambar dari kamera

    if (!nik || (jenis_absen !== 'Masuk' && jenis_absen !== 'Pulang')) {
      return NextResponse.json({ success: false, error: 'Data absensi tidak valid / tidak lengkap.' }, { status: 400 });
    }

    if (!foto_absen) {
      return NextResponse.json({ success: false, error: 'Foto absensi wajib dilampirkan.' }, { status: 400 });
    }

    // 2. Pemrosesan File Gambar ke Server Lokal
    const buffer = Buffer.from(await foto_absen.arrayBuffer());
    // Format: NIK_Masuk_17000000000.jpg
    const filename = `${nik}_${jenis_absen}_${Date.now()}.jpg`; 
    const uploadDir = path.join(process.cwd(), "public/uploads/absensi");
    
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), buffer);

    // 3. Format Lokasi (Gabungan GPS + Alamat)
    let lokasiGabungan = 'Kantor / Lapangan';
    if (latitude && longitude && lokasi_alamat) {
      lokasiGabungan = `${latitude},${longitude} - ${lokasi_alamat}`;
    }

    // 4. Ambil username supervisor dari tabel data_non_fronting (Logika Asli Anda)
    const [pegawaiRows] = await pool.query(`
      SELECT 
        COALESCE(s.username, p.supervisor) AS supervisor_username,
        s.nama AS nama_supervisor 
      FROM data_non_fronting p
      LEFT JOIN data_non_fronting s ON p.supervisor = s.username OR p.supervisor = s.nama
      WHERE p.nik = ? 
      LIMIT 1
    `, [nik]);

    if (pegawaiRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Data pegawai tidak ditemukan' }, { status: 404 });
    }

    const supervisorUsername = pegawaiRows[0].supervisor_username;
    const namaSupervisor = pegawaiRows[0].nama_supervisor;

    if (!supervisorUsername) {
      return NextResponse.json({ success: false, error: 'Pegawai ini belum memiliki supervisor yang terikat' }, { status: 400 });
    }

    // 5. Cek apakah pegawai sudah melakukan absensi hari ini
    const [existingAbsen] = await pool.query(
      `SELECT id, waktu_keluar FROM absensi WHERE nik = ? AND tanggal = CURDATE() LIMIT 1`,
      [nik]
    );

    if (jenis_absen === 'Masuk') {
      if (existingAbsen.length > 0) {
        return NextResponse.json({ 
          success: false, message: 'Anda sudah melakukan absen masuk hari ini.' 
        }, { status: 400 });
      }

      // Insert data baru untuk Absen Masuk (Menambahkan foto_masuk)
      await pool.query(`
        INSERT INTO absensi (nik, nama, unit_kerja, nama_supervisor, tanggal, waktu_masuk, waktu_keluar, lokasi, status, foto_masuk)
        VALUES (?, ?, ?, ?, CURDATE(), NOW(), NULL, ?, 'HADIR', ?)
      `, [nik, nama, unit_kerja, namaSupervisor, lokasiGabungan, filename]);

    } else if (jenis_absen === 'Pulang') {
      if (existingAbsen.length === 0) {
        return NextResponse.json({ 
          success: false, message: 'Anda belum melakukan absen masuk hari ini. Silakan absen masuk terlebih dahulu.' 
        }, { status: 400 });
      }

      if (existingAbsen[0].waktu_keluar !== null) {
        return NextResponse.json({ 
          success: false, message: 'Anda sudah melakukan absen pulang hari ini.' 
        }, { status: 400 });
      }

      // Update waktu_keluar untuk Absen Pulang (Menambahkan foto_keluar)
      await pool.query(`
        UPDATE absensi 
        SET waktu_keluar = NOW(), foto_keluar = ? 
        WHERE id = ?
      `, [filename, existingAbsen[0].id]);
    }

    // 6. Kirim Notifikasi ke Supervisor dan HRD (Logika Asli Anda)
    const tipePesan = `Absensi ${jenis_absen}`;
    const kontenPesan = `Pegawai ${nama} (NIK: ${nik}) telah melakukan absensi ${jenis_absen} pada lokasi: ${lokasiGabungan}`;

    // Kirim ke Supervisor
    if (supervisorUsername) {
      await pool.query(`
        INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
        VALUES ('Pegawai', ?, ?, ?, 0, NOW())
      `, [supervisorUsername, tipePesan, kontenPesan]);
    }

    // Kirim ke HRD
    await pool.query(`
      INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
      VALUES ('Pegawai', 'HRD', ?, ?, 0, NOW())
    `, [tipePesan, kontenPesan]);

    return NextResponse.json({ 
      success: true, 
      message: `Absen ${jenis_absen} berhasil dicatat, foto tersimpan, dan notifikasi terkirim.` 
    });

  } catch (error) {
    console.error('Error proses absensi:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}