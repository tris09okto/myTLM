import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

// GET: Menarik daftar laporan dari pegawai yang di bawah supervisi SPV tertentu
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const spvName = searchParams.get('spvName');

    if (!spvName) {
      return NextResponse.json({ success: false, error: 'Nama Supervisor tidak diberikan' }, { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT l.id, l.nik, l.nama, l.pesan as deskripsi, l.foto as file_name, l.created_at, 
              CONCAT('Laporan dari ', l.nama, ' (NIK: ', l.nik, ')') as judul
       FROM laporan_aduan l
       JOIN data_non_fronting d ON l.nik = d.nik
       WHERE d.supervisor = ?
       ORDER BY l.created_at DESC`,
      [spvName]
    ) as [any[], any];

    return NextResponse.json({ success: true, data: rows }, { status: 200 });
  } catch (error) {
    console.error("Database Error pada GET /api/spv/laporan:", error);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data laporan tim' }, { status: 500 });
  }
}

// PUT: Menyimpan balasan supervisor/MO dan mengirim notifikasi otomatis ke pegawai
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, answer } = body;

    if (!id || !answer) {
      return NextResponse.json({ success: false, message: 'ID laporan dan isi balasan wajib diisi.' }, { status: 400 });
    }

    // 1. PERBAIKAN: Lakukan JOIN untuk mengetahui siapa NAMA SUPERVISOR dari pegawai tersebut
    const [existing] = await pool.query(
      `SELECT l.nik, l.nama, l.pesan, d.supervisor as supervisor
       FROM laporan_aduan l
       LEFT JOIN data_non_fronting d ON l.nik = d.nik
       WHERE l.id = ?`,
      [id]
    ) as [any[], any];

    if (existing.length === 0) {
      return NextResponse.json({ success: false, message: 'Laporan tidak ditemukan.' }, { status: 404 });
    }

    const report = existing[0];
    const currentPesan = report.pesan;
    const pegawaiNik = report.nik;
    const pegawaiNama = report.nama;

    // Ambil nama asli supervisor (jika kosong, fallback ke 'Supervisor')
    const supervisorName = report.supervisor || 'Supervisor';

    // 2. Format penyimpanan balasan di-APPEND (Ditambahkan ke bawah)
    // PERBAIKAN: Jangan gunakan .split() atau ternary operator lagi
    const updatedPesan = currentPesan + `\n\nJawaban SPV :\n${answer}`;

    // 3. Update data isi laporan di database laporan_aduan
    await pool.query(
      `UPDATE laporan_aduan SET pesan = ? WHERE id = ?`,
      [updatedPesan, id]
    );

    // 4. Kirim notifikasi otomatis ke Pegawai yang bersangkutan dengan NAMA ASLI SPV
    const kontenNotifPegawai = `[Balasan ${supervisorName}] Tanggapan untuk laporan Anda: "${answer}"`;
    await pool.query(
      `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [supervisorName, pegawaiNik, 'Balasan Laporan Pegawai', kontenNotifPegawai]
    );

    const tambahanKontenMO = `\n\n----------------------------------\n[Respon Supervisor: ${supervisorName}]\n"${answer}"`;
    await pool.query(
      `UPDATE pesan_notifikasi 
       SET konten = CONCAT(konten, ?), is_read = 0 
       WHERE penerima_nik = 'MO' 
         AND tipe_pesan = 'Laporan Pegawai' 
         AND konten LIKE ?`,
      [tambahanKontenMO, `%${pegawaiNik}%`]
    );

    // 5. PERBAIKAN: Kirim tembusan (CC) ke MO menggunakan tabel pesan_notifikasi
    // Pastikan 'MO' adalah identifier/username yang tepat untuk akun MO di sistem Anda. 
    // Jika MO menggunakan NIK asli untuk login, ganti 'MO' dengan NIK asli tersebut.
    /*const kontenNotifMO = `Tembusan: Supervisor telah membalas aduan dari ${pegawaiNama} (NIK: ${pegawaiNik}).\n\nIsi Balasan SPV:\n"${answer}"`;
    await pool.query(
      `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [pegawaiNik, 'MO', 'Balasan Laporan Pegawai', kontenNotifMO]
    );*/

    return NextResponse.json({ 
      success: true, 
      message: 'Balasan berhasil dikirim dan notifikasi telah diteruskan ke Pegawai & MO.' 
    }, { status: 200 });

  } catch (error) {
    console.error("Database Error pada PUT /api/spv/laporan:", error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan balasan.' }, { status: 500 });
  }
}