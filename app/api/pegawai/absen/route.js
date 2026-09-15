import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { nik, nama, unit_kerja, lokasi, jenis_absen } = body; // jenis_absen: 'Masuk' atau 'Pulang'

    if (!nik || !jenis_absen) {
      return NextResponse.json({ success: false, error: 'Data tidak lengkap' }, { status: 400 });
    }

    // 1. Ambil username supervisor dari tabel data_non_fronting
    const [pegawaiRows] = await pool.query(`
      SELECT 
        p.supervisor AS supervisor_username, 
        s.nama AS nama_supervisor 
      FROM data_non_fronting p
      LEFT JOIN data_non_fronting s ON p.supervisor = s.username
      WHERE p.nik = ? 
      LIMIT 1
    `, [nik]);

    if (pegawaiRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Data pegawai tidak ditemukan' }, { status: 404 });
    }

    const supervisorUsername = pegawaiRows[0].supervisor_username; // Username supervisor untuk kolom penerima_nik
    const namaSupervisor = pegawaiRows[0].nama_supervisor; // Menyesuaikan kolom nama_supervisor di tabel absensi

    if (!supervisorUsername) {
      return NextResponse.json({ success: false, error: 'Pegawai ini belum memiliki supervisor yang terikat' }, { status: 400 });
    }

    // 2. Cek apakah pegawai sudah melakukan absensi hari ini (maksimal sekali sehari)
    const [existingAbsen] = await pool.query(
      `SELECT id FROM master_absensi WHERE nik = ? AND DATE(created_at) = CURDATE() LIMIT 1`,
      [nik]
    );

    if (jenis_absen === 'Masuk') {
      if (existingAbsen.length > 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'Anda sudah melakukan absen masuk hari ini.' 
        }, { status: 400 });
      }

      // Insert data baru untuk Absen Masuk
      await pool.query(`
        INSERT INTO absensi (nik, nama, unit_kerja, nama_supervisor, tanggal, waktu_masuk, waktu_keluar, lokasi, status)
        VALUES (?, ?, ?, ?, CURDATE(), NOW(), NULL, ?, 'HADIR')
      `, [nik, nama, unit_kerja, namaSupervisor, lokasi || 'Kantor / Lapangan']);

    } else if (jenis_absen === 'Pulang') {
      if (existingAbsen.length === 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'Anda belum melakukan absen masuk hari ini. Silakan absen masuk terlebih dahulu.' 
        }, { status: 400 });
      }

      if (existingAbsen[0].waktu_keluar !== null) {
        return NextResponse.json({ 
          success: false, 
          message: 'Anda sudah melakukan absen pulang hari ini.' 
        }, { status: 400 });
      }

      // Update waktu_keluar untuk Absen Pulang
      await pool.query(`
        UPDATE absensi 
        SET waktu_keluar = NOW() 
        WHERE id = ?
      `, [existingAbsen[0].id]);
    }

    // 3. Kirim Notifikasi ke Supervisor dan HRD
    const tipePesan = `Absensi ${jenis_absen}`;
    const kontenPesan = `Pegawai ${nama} (NIK: ${nik}) telah melakukan absensi ${jenis_absen} pada lokasi: ${lokasi || 'Kantor / Lapangan'}`;

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
      message: `Absen ${jenis_absen} berhasil dicatat dan notifikasi terkirim.` 
    });

  } catch (error) {
    console.error('Error proses absensi:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}