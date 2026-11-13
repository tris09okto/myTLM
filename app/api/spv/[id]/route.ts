import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { cleanupStoredUploads, storeFileUpload } from "@/lib/uploads";

type SqlParam = string | number | boolean | Date | Buffer | null;
type StoredUpload = Awaited<ReturnType<typeof storeFileUpload>>;

interface ExistingSupervisorRow extends RowDataPacket {
  id: number;
  username: string | null;
  pas_foto: string | null;
  surat_tugas: string | null;
}

interface ExistingUserRow extends RowDataPacket {
  id: number;
  username: string;
}

// PUT /api/spv/[id] -> Edit data supervisor & sinkronisasi password/username ke tabel users
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let conn = null;
  let transactionStarted = false;
  let committed = false;
  const uploads: StoredUpload[] = [];

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role?.toUpperCase() !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const supervisorId = Number(id);
    if (!Number.isInteger(supervisorId) || supervisorId <= 0) {
      return NextResponse.json(
        { success: false, message: "ID supervisor tidak valid" },
        { status: 400 }
      );
    }

    const [existingRows] = await pool.execute<ExistingSupervisorRow[]>(
      `SELECT id, username, pas_foto, surat_tugas
       FROM data_non_fronting
       WHERE id = ? AND UPPER(jabatan) = 'SUPERVISOR'
       LIMIT 1`,
      [supervisorId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Data supervisor tidak ditemukan" },
        { status: 404 }
      );
    }

    const existingSupervisor = existingRows[0];
    const oldUsername = existingSupervisor.username?.trim() || "";
    const contentType = req.headers.get("content-type") ?? "";

    let rawFields: Record<string, unknown> = {};
    let pasFotoFile: File | null = null;
    let suratTugasFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") {
          rawFields[key] = value;
        }
      });

      const fotoEntry = formData.get("pas_foto_file");
      if (
        fotoEntry instanceof File &&
        fotoEntry.name.trim() &&
        fotoEntry.size > 0
      ) {
        pasFotoFile = fotoEntry;
      }

      const suratEntry = formData.get("surat_tugas_file");
      if (
        suratEntry instanceof File &&
        suratEntry.name.trim() &&
        suratEntry.size > 0
      ) {
        suratTugasFile = suratEntry;
      }
    } else {
      rawFields = (await req.json()) as Record<string, unknown>;
    }

    const nama = String(rawFields.nama ?? "").trim();
    const nik = String(rawFields.nik ?? "").trim();
    const jenisKelamin = String(rawFields.jenis_kelamin ?? "").trim();
    const tempatLahir = String(rawFields.tempat_lahir ?? "").trim();
    const tanggalLahir = String(rawFields.tanggal_lahir ?? "").trim();
    const golonganDarah = String(rawFields.golongan_darah ?? "").trim() || null;
    const statusPernikahan = String(rawFields.status_pernikahan ?? "").trim();
    const domisili = String(rawFields.domisili ?? "").trim();
    const email = String(rawFields.email ?? "").trim();
    const noWhatsapp = String(
      rawFields.no_whatsapp ?? rawFields.no_hp ?? ""
    ).trim();
    const mitraId =
      rawFields.mitra_id !== undefined &&
      rawFields.mitra_id !== null &&
      String(rawFields.mitra_id).trim() !== ""
        ? Number(rawFields.mitra_id)
        : null;
    const areaPenempatan = String(rawFields.area_penempatan ?? "").trim();
    const alamatAreaPenempatan = String(
      rawFields.alamat_area_penempatan ?? ""
    ).trim();
    const masaKerja = String(rawFields.masa_kerja ?? "").trim();
    const tanggalMulaiKerja =
      String(rawFields.tanggal_mulai_kerja ?? "").trim() || null;
    const masaKontrak = String(rawFields.masa_kontrak ?? "").trim() || null;
    const status = rawFields.status === "NON-AKTIF" ? "NON-AKTIF" : "AKTIF";
    const username = String(rawFields.username ?? "").trim();
    const password = String(rawFields.password ?? "").trim();

    if (!nama || !nik || !username || !email || !tanggalLahir) {
      return NextResponse.json(
        {
          success: false,
          message: "Nama, NIK, tanggal lahir, username, dan email wajib diisi",
        },
        { status: 400 }
      );
    }

    // Cek duplikasi username di tabel data_non_fronting
    const [duplicateSpvRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM data_non_fronting WHERE username = ? AND id != ? LIMIT 1`,
      [username, supervisorId]
    );

    if (duplicateSpvRows.length > 0) {
      return NextResponse.json(
        { success: false, message: "Username sudah digunakan oleh akun lain" },
        { status: 409 }
      );
    }

    // Cek duplikasi username di tabel users jika username diubah
    if (oldUsername && oldUsername !== username) {
      const [duplicateUserRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM users WHERE username = ? AND username != ? LIMIT 1`,
        [username, oldUsername]
      );

      if (duplicateUserRows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Username sudah terdaftar pada tabel users",
          },
          { status: 409 }
        );
      }
    }

    // 1. Upload Pas Foto baru ke folder "pas_foto" jika dipilih
    let pasFotoRef =
      String(rawFields.pas_foto ?? "").trim() ||
      existingSupervisor.pas_foto ||
      "";

    if (pasFotoFile) {
      const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedImageTypes.includes(pasFotoFile.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Format Pas Foto harus JPG, PNG, atau WEBP",
          },
          { status: 400 }
        );
      }
      if (pasFotoFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "Ukuran Pas Foto maksimal 5MB" },
          { status: 400 }
        );
      }

      const storedFoto = await storeFileUpload({
        file: pasFotoFile,
        folder: "pas_foto",
        localFileName: `pasfoto_${Date.now()}_${pasFotoFile.name.replace(/\s+/g, "_")}`,
        resourceType: "image",
      });
      uploads.push(storedFoto);
      pasFotoRef = storedFoto.reference;
    }

    // 2. Upload Surat Tugas baru ke folder "surat_tugas" jika dipilih
    let suratTugasRef =
      String(rawFields.surat_tugas ?? "").trim() ||
      existingSupervisor.surat_tugas ||
      "";

    if (suratTugasFile) {
      const allowedDocTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
      ];
      if (!allowedDocTypes.includes(suratTugasFile.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "Format Surat Tugas harus PDF, JPG, PNG, atau WEBP",
          },
          { status: 400 }
        );
      }
      if (suratTugasFile.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: "Ukuran Surat Tugas maksimal 10MB" },
          { status: 400 }
        );
      }

      const storedSurat = await storeFileUpload({
        file: suratTugasFile,
        folder: "surat_tugas",
        localFileName: `st_${Date.now()}_${suratTugasFile.name.replace(/\s+/g, "_")}`,
        resourceType: "raw",
      });
      uploads.push(storedSurat);
      suratTugasRef = storedSurat.reference;
    }

    // Hash password satu kali jika admin mengisi password baru
    const hashedPassword =
      password.length > 0 ? await bcrypt.hash(password, 10) : null;

    // 3. Mulai transaksi database
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const updateFields: string[] = [
      "id_mitra = ?",
      "nama = ?",
      "nik = ?",
      "jenis_kelamin = ?",
      "area_penempatan = ?",
      "alamat_area_penempatan = ?",
      "status_pernikahan = ?",
      "golongan_darah = ?",
      "masa_kerja = ?",
      "tanggal_mulai_kerja = ?",
      "masa_kontrak = ?",
      "domisili = ?",
      "email = ?",
      "tempat_lahir = ?",
      "tanggal_lahir = ?",
      "no_whatsapp = ?",
      "pas_foto = ?",
      "surat_tugas = ?",
      "username = ?",
      "status = ?",
    ];

    const queryParams: SqlParam[] = [
      mitraId,
      nama,
      nik,
      jenisKelamin,
      areaPenempatan,
      alamatAreaPenempatan,
      statusPernikahan,
      golonganDarah,
      masaKerja,
      tanggalMulaiKerja,
      masaKontrak,
      domisili,
      email,
      tempatLahir,
      tanggalLahir,
      noWhatsapp,
      pasFotoRef,
      suratTugasRef,
      username,
      status,
    ];

    if (hashedPassword) {
      updateFields.push("password = ?");
      queryParams.push(hashedPassword);
    }

    queryParams.push(supervisorId);

    // Update tabel data_non_fronting
    await conn.execute<ResultSetHeader>(
      `UPDATE data_non_fronting
       SET ${updateFields.join(", ")}
       WHERE id = ? AND UPPER(jabatan) = 'SUPERVISOR'`,
      queryParams
    );

    // Update relasi username pada pegawai bawahan jika username supervisor berubah
    if (oldUsername && oldUsername !== username) {
      await conn.execute<ResultSetHeader>(
        `UPDATE data_non_fronting SET supervisor = ? WHERE supervisor = ?`,
        [username, oldUsername]
      );
    }

    // 4. Sinkronisasi password dan/atau username ke tabel users
    const userUpdateFields: string[] = [];
    const userQueryParams: SqlParam[] = [];

    if (oldUsername && oldUsername !== username) {
      userUpdateFields.push("username = ?");
      userQueryParams.push(username);
    }

    if (hashedPassword) {
      userUpdateFields.push("password = ?");
      userQueryParams.push(hashedPassword);
    }

    if (userUpdateFields.length > 0) {
      const lookupUsername = oldUsername || username;
      const [userRows] = await conn.execute<ExistingUserRow[]>(
        `SELECT id, username FROM users WHERE username = ? LIMIT 1`,
        [lookupUsername]
      );

      if (userRows.length > 0) {
        userQueryParams.push(userRows[0].id);
        await conn.execute<ResultSetHeader>(
          `UPDATE users SET ${userUpdateFields.join(", ")} WHERE id = ?`,
          userQueryParams
        );
      }
    }

    await conn.commit();
    committed = true;

    return NextResponse.json({
      success: true,
      message: "Data supervisor dan akun login berhasil diperbarui",
      data: {
        pas_foto: pasFotoRef,
        surat_tugas: suratTugasRef,
      },
    });
  } catch (error: unknown) {
    let rolledBack = !transactionStarted;
    if (conn && transactionStarted && !committed) {
      try {
        await conn.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error(
          "Gagal membatalkan transaksi update supervisor:",
          rollbackError
        );
      }
    }

    if (!committed && rolledBack && uploads.length > 0) {
      await cleanupStoredUploads(uploads);
    }

    console.error("PUT /api/spv/[id] error:", error);
    const errMessage =
      error instanceof Error
        ? error.message
        : "Gagal memperbarui data supervisor";
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 500 }
    );
  } finally {
    if (conn) conn.release();
  }
}

// DELETE /api/spv/[id] -> Hapus data supervisor beserta akunnya di tabel users
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const conn = await pool.getConnection();
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role?.toUpperCase() !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supervisorId = Number(id);
    if (!Number.isInteger(supervisorId) || supervisorId <= 0) {
      return NextResponse.json(
        { success: false, message: "ID supervisor tidak valid" },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    const [existingRows] = await conn.execute<ExistingSupervisorRow[]>(
      `SELECT id, username
       FROM data_non_fronting
       WHERE id = ? AND UPPER(jabatan) = 'SUPERVISOR'
       LIMIT 1`,
      [supervisorId]
    );

    if (existingRows.length === 0) {
      await conn.rollback();
      return NextResponse.json(
        { success: false, message: "Data supervisor tidak ditemukan" },
        { status: 404 }
      );
    }

    const supervisorUsername = existingRows[0].username;

    if (supervisorUsername) {
      await conn.execute<ResultSetHeader>(
        `UPDATE data_non_fronting SET supervisor = NULL WHERE supervisor = ?`,
        [supervisorUsername]
      );

      await conn.execute<ResultSetHeader>(
        `DELETE FROM users WHERE username = ?`,
        [supervisorUsername]
      );
    }

    await conn.execute<ResultSetHeader>(
      `DELETE FROM data_non_fronting WHERE id = ? AND UPPER(jabatan) = 'SUPERVISOR'`,
      [supervisorId]
    );

    await conn.commit();

    return NextResponse.json({
      success: true,
      message: "Data supervisor berhasil dihapus",
    });
  } catch (error: unknown) {
    await conn.rollback();
    console.error("DELETE /api/spv/[id] error:", error);

    const mysqlErr = error as { errno?: number; code?: string };
    if (
      mysqlErr?.errno === 1451 ||
      mysqlErr?.code === "ER_ROW_IS_REFERENCED_2"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Supervisor tidak dapat dihapus karena masih terhubung dengan data tugas/transaksi aktif.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Gagal menghapus data supervisor" },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}