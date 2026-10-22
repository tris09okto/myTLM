import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cleanupStoredUploads, storeImageDataUrl, type StoredUpload } from "@/lib/uploads";

// Helper untuk mengambil Tanggal (YYYY-MM-DD) dan Waktu (HH:mm:ss) GMT+7 (WIB)
const getWIBDateTime = () => {
  const now = new Date();
  const tanggal = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); // Format YYYY-MM-DD
  const waktu = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false }); // Format HH:mm:ss
  return { tanggal, waktu };
};

export async function POST(req: Request) {
  let upload: StoredUpload | undefined;
  let safeToCleanup = true;
  let committed = false;

  try {
    // 1. Ambil data dari FormData
    const formData = await req.formData();
    const nik = formData.get("nik") as string;
    const nama = formData.get("nama") as string;
    const unit_kerja = formData.get("unit_kerja") as string;
    const jenis_absen = formData.get("jenis_absen") as "Masuk" | "Pulang";
    const latitude = formData.get("latitude") as string;
    const longitude = formData.get("longitude") as string;
    const lokasi_alamat = formData.get("lokasi_alamat") as string;
    const foto_absen = formData.get("foto_absen") as File | string | null;

    if (!nik || (jenis_absen !== 'Masuk' && jenis_absen !== 'Pulang')) {
      return NextResponse.json({ success: false, error: 'Data absensi tidak lengkap atau tidak valid.' }, { status: 400 });
    }

    if (!foto_absen) {
      return NextResponse.json({ success: false, error: 'Foto absensi wajib dilampirkan.' }, { status: 400 });
    }

    const { tanggal: tanggalWIB, waktu: waktuWIB } = getWIBDateTime();

    // 2. Konversi foto (File / Blob / Base64 String) ke Data URL Base64
    let urlFile = "";

    if (typeof foto_absen === 'string' && foto_absen.startsWith('data:image')) {
      urlFile = foto_absen;
    } else if (foto_absen && typeof (foto_absen as any).arrayBuffer === 'function') {
      const bytes = await (foto_absen as Blob).arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = (foto_absen as Blob).type || 'image/jpeg';
      urlFile = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    if (!urlFile || !urlFile.startsWith('data:image')) {
      return NextResponse.json(
        { success: false, error: 'Format file foto tidak valid atau gagal dibaca.' }, 
        { status: 400 }
      );
    }

    // 3. Ekstrak ekstensi dan simpan ke Cloudinary
    const subtype = /^data:image\/([A-Za-z0-9.+-]+);/.exec(urlFile)?.[1] ?? "img";
    const extension = subtype === "jpeg" ? "jpg" : subtype.split("+")[0].replace(/[^a-zA-Z0-9]/g, "") || "img";

    // Nilai folder diubah menjadi "absensi" agar sesuai dengan tipe di @/lib/uploads
    upload = await storeImageDataUrl({
      dataUrl: urlFile,
      folder: "pegawai/absensi" as any,
      localFileName: `absen_${nik}_${jenis_absen}_${Date.now()}.${extension}`,
    });

    const fotoReference = upload.reference;

    // 4. Format Lokasi Gabungan
    let lokasiGabungan = 'Kantor / Lapangan';
    if (latitude && longitude && lokasi_alamat) {
      lokasiGabungan = `${latitude},${longitude} - ${lokasi_alamat}`;
    }

    // 5. Transaksi Database
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // A. Ambil data supervisor pegawai
      const [pegawaiRows] = await connection.query(
        `SELECT 
          COALESCE(s.username, p.supervisor) AS supervisor_username,
          s.nama AS nama_supervisor 
        FROM data_non_fronting p
        LEFT JOIN data_non_fronting s ON p.supervisor = s.username OR p.supervisor = s.nama
        WHERE p.nik = ? 
        LIMIT 1`,
        [nik]
      ) as [any[], any];

      if (pegawaiRows.length === 0) {
        await connection.rollback();
        if (upload) await cleanupStoredUploads([upload]);
        return NextResponse.json({ success: false, error: 'Data pegawai tidak ditemukan dalam sistem.' }, { status: 404 });
      }

      const supervisorUsername = pegawaiRows[0].supervisor_username;
      const namaSupervisor = pegawaiRows[0].nama_supervisor;

      if (!supervisorUsername) {
        await connection.rollback();
        if (upload) await cleanupStoredUploads([upload]);
        return NextResponse.json({ success: false, error: 'Pegawai belum memiliki supervisor yang terikat.' }, { status: 400 });
      }

      // B. Cek status absensi hari ini
      const [existingAbsen] = await connection.query(
        `SELECT id, waktu_keluar FROM absensi WHERE nik = ? AND tanggal = ? LIMIT 1`,
        [nik, tanggalWIB]
      ) as [any[], any];

      if (jenis_absen === 'Masuk') {
        if (existingAbsen.length > 0) {
          await connection.rollback();
          if (upload) await cleanupStoredUploads([upload]);
          return NextResponse.json({ success: false, message: 'Anda sudah melakukan absen MASUK hari ini.' }, { status: 400 });
        }

        await connection.query(
          `INSERT INTO absensi (nik, nama, unit_kerja, nama_supervisor, tanggal, waktu_masuk, waktu_keluar, lokasi, status, foto_masuk)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'HADIR', ?)`,
          [nik, nama, unit_kerja, namaSupervisor, tanggalWIB, waktuWIB, lokasiGabungan, fotoReference]
        );

      } else if (jenis_absen === 'Pulang') {
        if (existingAbsen.length === 0) {
          await connection.rollback();
          if (upload) await cleanupStoredUploads([upload]);
          return NextResponse.json({ success: false, message: 'Anda belum melakukan absen masuk hari ini.' }, { status: 400 });
        }

        if (existingAbsen[0].waktu_keluar !== null) {
          await connection.rollback();
          if (upload) await cleanupStoredUploads([upload]);
          return NextResponse.json({ success: false, message: 'Anda sudah melakukan absen PULANG hari ini.' }, { status: 400 });
        }

        await connection.query(
          `UPDATE absensi 
           SET waktu_keluar = ?, foto_keluar = ? 
           WHERE id = ?`,
          [waktuWIB, fotoReference, existingAbsen[0].id]
        );
      }

      // C. Kirim Notifikasi Sistem
      const tipePesan = `Absensi ${jenis_absen}`;
      const kontenPesan = `Pegawai ${nama} (NIK: ${nik}) telah melakukan absensi ${jenis_absen} pada lokasi: ${lokasiGabungan}`;

      if (supervisorUsername) {
        await connection.query(
          `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
           VALUES ('Pegawai', ?, ?, ?, 0, NOW())`,
          [supervisorUsername, tipePesan, kontenPesan]
        );
      }

      await connection.query(
        `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
         VALUES ('Pegawai', 'HRD', ?, ?, 0, NOW())`,
        [tipePesan, kontenPesan]
      );

      await connection.commit();
      committed = true;

      return NextResponse.json({ 
        success: true, 
        message: `Absen ${jenis_absen} berhasil dicatat dan foto tersimpan.` 
      });

    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        safeToCleanup = false;
        console.error("Gagal melakukan rollback koneksi database:", rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }

  } catch (error: any) {
    if (!committed && safeToCleanup && upload) {
      await cleanupStoredUploads([upload]);
    }
    console.error("Error pada API Absensi:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Gagal memproses absensi: " + (error.message || error) 
    }, { status: 500 });
  }
}