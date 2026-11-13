import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { storeImageDataUrl, cleanupStoredUploads, type StoredUpload } from "@/lib/uploads";

// ==========================================
// 1. GET: Ambil Riwayat Pengajuan Izin Pegawai
// ==========================================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nik = (searchParams.get("nik") || "").trim();

    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT 
          i.*,
          COALESCE(p.nama, i.nik) AS nama,
          p.unit_kerja,
          p.jabatan,
          p.supervisor
        FROM pengajuan_izin i
        LEFT JOIN data_non_fronting p ON TRIM(i.nik) = TRIM(p.nik)
      `;
      const queryParams: any[] = [];

      if (nik) {
        query += ` WHERE TRIM(i.nik) = ? OR LOWER(TRIM(p.username)) = LOWER(?) ORDER BY i.id DESC`;
        queryParams.push(nik, nik);
      } else {
        query += ` ORDER BY i.id DESC`;
      }

      const [rows]: any = await connection.query(query, queryParams);
      connection.release();

      // Normalisasi nama kolom lampiran agar selalu terbaca sebagai file_bukti
      const normalizedData = rows.map((row: any) => ({
        ...row,
        file_bukti:
          row.file_bukti ||
          row.file_lampiran ||
          row.foto_bukti ||
          row.lampiran ||
          row.bukti ||
          row.file_name ||
          row.dokumen ||
          row.file ||
          "",
      }));

      return NextResponse.json({
        success: true,
        data: normalizedData,
      });
    } catch (dbError: any) {
      connection.release();
      console.error("Database error GET /api/pegawai/pengajuan-izin:", dbError);
      return NextResponse.json(
        { success: false, message: "Gagal mengambil riwayat izin: " + dbError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error GET /api/pegawai/pengajuan-izin:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

// ==========================================
// 2. POST: Simpan Pengajuan Izin + Upload Bukti JPG/JPEG
// ==========================================
export async function POST(req: Request) {
  let upload: StoredUpload | undefined;
  let safeToCleanup = true;
  let committed = false;

  try {
    const formData = await req.formData();

    const nik = String(formData.get("nik") || "").trim();
    const nama = String(formData.get("nama") || "").trim();
    const unit_kerja = String(formData.get("unit_kerja") || "").trim();
    const jenis_izin = String(
      formData.get("jenis_izin") || formData.get("tipe_izin") || formData.get("jenis") || ""
    ).trim();
    const tanggal_mulai = String(
      formData.get("tanggal_mulai") || formData.get("tgl_mulai") || formData.get("tanggal") || ""
    ).trim();
    const tanggal_selesai = String(
      formData.get("tanggal_selesai") || formData.get("tgl_selesai") || tanggal_mulai
    ).trim();
    const alasan = String(
      formData.get("alasan") || formData.get("keterangan") || formData.get("deskripsi") || ""
    ).trim();

    // Deteksi file bukti dari FormData
    let uploadedFile: Blob | null = null;
    let uploadedFileName = "";
    let base64StringInput = "";

    for (const [key, value] of formData.entries()) {
      if (
        value &&
        typeof value === "object" &&
        typeof (value as any).arrayBuffer === "function" &&
        (value as Blob).size > 0
      ) {
        uploadedFile = value as Blob;
        uploadedFileName = (value as File).name || key;
        break;
      }
      if (typeof value === "string" && value.startsWith("data:")) {
        base64StringInput = value;
        break;
      }
    }

    // Validasi field wajib
    const missingFields: string[] = [];
    if (!nik || nik === "undefined" || nik === "null") missingFields.push("NIK");
    if (!jenis_izin) missingFields.push("Jenis Izin");
    if (!tanggal_mulai) missingFields.push("Tanggal Mulai");
    if (!alasan) missingFields.push("Alasan");

    if (missingFields.length > 0) {
      const errorMsg = `Data pengajuan izin belum lengkap (${missingFields.join(", ")} wajib diisi).`;
      return NextResponse.json(
        { success: false, error: errorMsg, message: errorMsg },
        { status: 400 }
      );
    }

    // Konversi File/Blob ke Base64 Data URL & Validasi Khusus JPG / JPEG
    let urlFile = base64StringInput;
    if (!urlFile && uploadedFile) {
      // Validasi ukuran maksimal 5MB
      if (uploadedFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            error: "Ukuran file bukti terlalu besar. Maksimal 5MB.",
            message: "Ukuran file bukti terlalu besar. Maksimal 5MB.",
          },
          { status: 400 }
        );
      }

      const bytes = await uploadedFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = uploadedFile.type || "";
      urlFile = `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    let fotoReference = "";
    if (urlFile) {
      const isJpegMime = /^data:image\/jpeg;base64,/i.test(urlFile);
      const fileNameLower = uploadedFileName.toLowerCase();
      const isJpegExt =
        !uploadedFileName ||
        fileNameLower.endsWith(".jpg") ||
        fileNameLower.endsWith(".jpeg");

      if (!isJpegMime || !isJpegExt) {
        const msg =
          "Format file bukti ditolak! Sistem hanya menerima file gambar berformat .JPG atau .JPEG.";
        return NextResponse.json(
          { success: false, error: msg, message: msg },
          { status: 400 }
        );
      }

      try {
        upload = await storeImageDataUrl({
          dataUrl: urlFile,
          folder: "pegawai/izin_pegawai" as any,
          localFileName: `izin_${nik}_${Date.now()}.jpg`,
        });

        fotoReference =
          upload?.reference ||
          (upload as any)?.url ||
          (upload as any)?.secure_url ||
          "";

        if (!fotoReference) {
          throw new Error("Uploader tidak mengembalikan URL/reference file.");
        }
      } catch (uploadErr: any) {
        console.error("[Pengajuan Izin] Gagal upload ke Cloudinary:", uploadErr);
        return NextResponse.json(
          {
            success: false,
            error: "Gagal mengunggah file bukti: " + (uploadErr.message || uploadErr),
            message: "Gagal mengunggah file bukti: " + (uploadErr.message || uploadErr),
          },
          { status: 500 }
        );
      }
    }

    // Simpan ke Database MySQL
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Cek apakah ada izin aktif di tanggal yang sama
      const [existingIzin]: any = await connection.query(
        `SELECT id FROM pengajuan_izin 
         WHERE TRIM(nik) = ? 
         AND status != 'DITOLAK'
         AND (
           (tanggal_mulai BETWEEN ? AND ?) OR 
           (tanggal_selesai BETWEEN ? AND ?) OR
           (? BETWEEN tanggal_mulai AND tanggal_selesai)
         ) LIMIT 1`,
        [nik, tanggal_mulai, tanggal_selesai, tanggal_mulai, tanggal_selesai, tanggal_mulai]
      );

      if (existingIzin && existingIzin.length > 0) {
        await connection.rollback();
        if (upload) await cleanupStoredUploads([upload]);
        return NextResponse.json(
          {
            success: false,
            error: "Anda sudah memiliki pengajuan izin aktif pada rentang tanggal tersebut.",
            message: "Anda sudah memiliki pengajuan izin aktif pada rentang tanggal tersebut.",
          },
          { status: 409 }
        );
      }

      // Periksa struktur kolom tabel pengajuan_izin
      const [columnsRows]: any = await connection.query(`SHOW COLUMNS FROM pengajuan_izin`);
      const existingCols = new Set(
        columnsRows.map((col: any) => String(col.Field).toLowerCase())
      );

      // Pastikan kolom file_bukti tersedia di tabel pengajuan_izin
      const fileColCandidates = [
        "file_bukti",
        "file_lampiran",
        "foto_bukti",
        "lampiran",
        "bukti",
        "file_name",
        "dokumen",
        "file",
      ];
      let targetFileCol = fileColCandidates.find((col) => existingCols.has(col));

      if (!targetFileCol) {
        await connection.query(
          `ALTER TABLE pengajuan_izin ADD COLUMN file_bukti VARCHAR(255) NULL`
        );
        targetFileCol = "file_bukti";
      }

      const insertData: Record<string, any> = {
        nik,
        tanggal_mulai,
        tanggal_selesai,
        status: "PENDING",
        [targetFileCol]: fotoReference || null,
      };

      if (existingCols.has("nama")) insertData.nama = nama;
      if (existingCols.has("unit_kerja")) insertData.unit_kerja = unit_kerja;
      if (existingCols.has("jenis_izin")) insertData.jenis_izin = jenis_izin;
      else if (existingCols.has("tipe_izin")) insertData.tipe_izin = jenis_izin;
      if (existingCols.has("alasan")) insertData.alasan = alasan;
      else if (existingCols.has("keterangan")) insertData.keterangan = alasan;

      const colNames = Object.keys(insertData);
      const placeholders = colNames.map(() => "?").join(", ");
      const values = Object.values(insertData);

      let timestampCol = "";
      if (existingCols.has("created_at")) timestampCol = ", created_at";
      else if (existingCols.has("tanggal_pengajuan")) timestampCol = ", tanggal_pengajuan";

      await connection.query(
        `INSERT INTO pengajuan_izin (${colNames.join(", ")}${timestampCol})
         VALUES (${placeholders}${timestampCol ? ", NOW()" : ""})`,
        values
      );

      // Kirim notifikasi ke Supervisor & HRD
      const [pegawaiRows]: any = await connection.query(
        `SELECT 
          p.nama,
          p.supervisor,
          COALESCE(s.username, p.supervisor) AS supervisor_username
         FROM data_non_fronting p
         LEFT JOIN data_non_fronting s 
           ON (LOWER(TRIM(p.supervisor)) = LOWER(TRIM(s.username)) 
            OR LOWER(TRIM(p.supervisor)) = LOWER(TRIM(s.nama)) 
            OR LOWER(TRIM(p.supervisor)) = LOWER(TRIM(s.nik)))
         WHERE TRIM(p.nik) = ? OR LOWER(TRIM(p.username)) = LOWER(?)
         LIMIT 1`,
        [nik, nik]
      );

      const namaPegawai = pegawaiRows[0]?.nama || nama || nik;
      const supervisorTarget = pegawaiRows[0]?.supervisor_username;
      const tipePesan = `Pengajuan ${jenis_izin}`;
      const kontenPesan = `Pegawai ${namaPegawai} (NIK: ${nik}) mengajukan ${jenis_izin} tanggal ${tanggal_mulai} s.d. ${tanggal_selesai}. Alasan: ${alasan}`;

      if (supervisorTarget && supervisorTarget !== nik) {
        await connection.query(
          `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, is_read, created_at)
           VALUES ('Pegawai', ?, ?, ?, 0, NOW())`,
          [supervisorTarget, tipePesan, kontenPesan]
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
        message: "Pengajuan izin berhasil dikirim dan menunggu persetujuan Supervisor.",
        file_bukti: fotoReference,
      });
    } catch (dbErr: any) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        safeToCleanup = false;
      }
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    if (!committed && safeToCleanup && upload) {
      await cleanupStoredUploads([upload]);
    }
    console.error("Error POST /api/pegawai/pengajuan-izin:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal memproses pengajuan izin: " + (error.message || error),
        message: "Gagal memproses pengajuan izin: " + (error.message || error),
      },
      { status: 500 }
    );
  }
}