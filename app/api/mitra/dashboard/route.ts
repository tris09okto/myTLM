import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

function getTodayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = (searchParams.get("username") || "").trim();
    const email = (searchParams.get("email") || "").trim();
    const kodeMitraParam = (searchParams.get("kode_mitra") || "").trim();
    const idMitraParam = (searchParams.get("id_mitra") || "").trim();

    // Kunci tanggal monitoring ke tanggal hari ini (WIB / Asia/Jakarta)
    const todayDate = getTodayJakarta();

    if (!username && !email && !kodeMitraParam && !idMitraParam) {
      return NextResponse.json(
        { success: false, error: "Identitas sesi login mitra tidak ditemukan." },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      // Kumpulkan variasi identifier sesi login mitra
      const identifierSet = new Set<string>();
      const addIdentifier = (val: string) => {
        const clean = val.trim().toLowerCase();
        if (!clean) return;
        identifierSet.add(clean);
        identifierSet.add(clean.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim());
        identifierSet.add(clean.replace(/\s+/g, "_"));
      };

      [username, email, kodeMitraParam, idMitraParam].forEach((val) => {
        if (val) addIdentifier(val);
      });

      const findMitraByIdentifiers = async (keys: string[]) => {
        if (keys.length === 0) return null;
        const placeholders = keys.map(() => "?").join(", ");
        const [rows]: any = await connection.query(
          `SELECT id, kode_mitra, nama_mitra, email, no_telp, alamat_mitra, status
           FROM mitra
           WHERE LOWER(TRIM(kode_mitra)) IN (${placeholders})
              OR LOWER(TRIM(email)) IN (${placeholders})
              OR LOWER(TRIM(nama_mitra)) IN (${placeholders})
              OR REPLACE(LOWER(TRIM(nama_mitra)), ' ', '_') IN (${placeholders})
              OR TRIM(no_telp) IN (${placeholders})
              OR CAST(id AS CHAR) IN (${placeholders})
           LIMIT 1`,
          [...keys, ...keys, ...keys, ...keys, ...keys, ...keys]
        );
        return rows.length > 0 ? rows[0] : null;
      };

      // 1. Cari profil mitra langsung di tabel mitra
      let mitra = await findMitraByIdentifiers(Array.from(identifierSet));

      // 2. Fallback lookup melalui tabel autentikasi yang memiliki kolom 'username'
      if (!mitra && username) {
        const [userTables]: any = await connection.query(
          `SELECT DISTINCT TABLE_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND COLUMN_NAME = 'username'
             AND TABLE_NAME != 'data_non_fronting'`
        );

        for (const tblRow of userTables) {
          const tableName = tblRow.TABLE_NAME || tblRow.table_name;
          if (!tableName) continue;

          const [cols]: any = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
          const colNames = new Set(cols.map((c: any) => String(c.Field).toLowerCase()));

          const searchCols = ["username", "email", "name", "nama"].filter((c) => colNames.has(c));
          const selectCols = ["id_mitra", "kode_mitra", "email", "name", "nama", "username"].filter((c) =>
            colNames.has(c)
          );

          if (searchCols.length > 0 && selectCols.length > 0) {
            const keys = Array.from(identifierSet);
            const placeholders = keys.map(() => "?").join(", ");
            const whereClause = searchCols
              .map((col) => `LOWER(TRIM(${col})) IN (${placeholders})`)
              .join(" OR ");
            const whereParams = searchCols.flatMap(() => keys);

            const [authRows]: any = await connection.query(
              `SELECT ${selectCols.join(", ")} FROM \`${tableName}\` WHERE ${whereClause} LIMIT 1`,
              whereParams
            );

            if (authRows.length > 0) {
              const row = authRows[0];
              selectCols.forEach((col) => {
                if (row[col] !== null && row[col] !== undefined && String(row[col]).trim() !== "") {
                  addIdentifier(String(row[col]));
                }
              });

              mitra = await findMitraByIdentifiers(Array.from(identifierSet));
              if (mitra) break;
            }
          }
        }
      }

      // 3. Fallback pencocokan parsial pada nama_mitra
      if (!mitra && username) {
        const normalizedKeyword = username.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
        if (normalizedKeyword.length >= 3) {
          const [partialRows]: any = await connection.query(
            `SELECT id, kode_mitra, nama_mitra, email, no_telp, alamat_mitra, status
             FROM mitra
             WHERE LOWER(TRIM(nama_mitra)) LIKE ?
             ORDER BY id ASC
             LIMIT 1`,
            [`%${normalizedKeyword.toLowerCase()}%`]
          );
          if (partialRows.length > 0) {
            mitra = partialRows[0];
          }
        }
      }

      if (!mitra) {
        connection.release();
        return NextResponse.json(
          {
            success: false,
            error: `Data mitra tidak ditemukan untuk akun "${username}". Pastikan data mitra sudah terdaftar di tabel mitra.`,
          },
          { status: 404 }
        );
      }

      // 4. Ambil data pegawai mitra + LEFT JOIN ke tabel absensi & pengajuan_izin per tanggal hari ini
      const [pegawaiRows]: any = await connection.query(
        `SELECT 
          nf.id,
          nf.id_mitra,
          nf.nama,
          nf.nik,
          nf.unit_kerja,
          nf.jabatan,
          nf.area_penempatan,
          nf.no_whatsapp,
          nf.status,
          MAX(a.id) AS absensi_id,
          MIN(a.waktu_masuk) AS waktu_masuk,
          MAX(a.waktu_keluar) AS waktu_keluar,
          MAX(a.lokasi) AS lokasi_absen,
          MAX(a.foto_masuk) AS foto_masuk,
          MAX(a.foto_keluar) AS foto_keluar,
          MAX(pi.id) AS izin_id,
          MAX(pi.jenis_izin) AS jenis_izin,
          MAX(pi.alasan) AS alasan_izin,
          MAX(pi.file_bukti) AS file_bukti_izin,
          MAX(pi.approved_by) AS approved_by,
          CASE 
            WHEN MAX(a.id) IS NOT NULL THEN 'HADIR'
            WHEN MAX(pi.id) IS NOT NULL THEN 'IZIN'
            ELSE 'BELUM_ABSEN'
          END AS status_kehadiran
        FROM data_non_fronting nf
        LEFT JOIN absensi a 
          ON TRIM(nf.nik) = TRIM(a.nik) 
          AND a.tanggal = ?
        LEFT JOIN pengajuan_izin pi 
          ON TRIM(nf.nik) = TRIM(pi.nik) 
          AND pi.status = 'DISETUJUI' 
          AND ? BETWEEN pi.tanggal_mulai AND pi.tanggal_selesai
        WHERE nf.id_mitra = ?
        GROUP BY nf.id
        ORDER BY nf.nama ASC`,
        [todayDate, todayDate, mitra.id]
      );

      connection.release();

      // 5. Kalkulasi ringkasan statistik kehadiran hari ini
      const totalPegawai = pegawaiRows.length;
      const totalHadir = pegawaiRows.filter((p: any) => p.status_kehadiran === "HADIR").length;
      const totalIzin = pegawaiRows.filter((p: any) => p.status_kehadiran === "IZIN").length;
      const totalBelumAbsen = pegawaiRows.filter((p: any) => p.status_kehadiran === "BELUM_ABSEN").length;

      return NextResponse.json({
        success: true,
        tanggal: todayDate,
        mitra: {
          id: mitra.id,
          kode_mitra: mitra.kode_mitra,
          nama_mitra: mitra.nama_mitra,
          email: mitra.email,
          no_telp: mitra.no_telp,
          alamat_mitra: mitra.alamat_mitra,
          status: mitra.status,
        },
        stats: {
          totalPegawai,
          totalHadir,
          totalIzin,
          totalBelumAbsen,
        },
        pegawaiList: pegawaiRows,
      });
    } catch (dbErr: any) {
      connection.release();
      console.error("Database error GET /api/mitra/dashboard:", dbErr);
      return NextResponse.json(
        { success: false, error: "Gagal mengambil data dashboard mitra: " + dbErr.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error GET /api/mitra/dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}