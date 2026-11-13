import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { authOptions } from "@/lib/auth";
import {pool} from "@/lib/db";

interface SupervisorRow extends RowDataPacket {
  id: number;
  nama: string;
  email: string;
  username: string | null;
  no_hp: string | null;
  mitra_id: number | null;
  unit_kerja: string | null;
  nama_mitra: string | null;
}

// PUT /api/supervisors/[id] -> Edit data supervisor
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (Number.isNaN(supervisorId)) {
      return NextResponse.json(
        { success: false, message: "ID supervisor tidak valid" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { nama, email, username, no_hp, mitra_id, unit_kerja, password } =
      body;

    if (!nama?.trim() || !email?.trim()) {
      return NextResponse.json(
        { success: false, message: "Nama dan email wajib diisi" },
        { status: 400 }
      );
    }

    // 1. Cek keberadaan supervisor
    const [existingRows] = await pool.execute<SupervisorRow[]>(
      `SELECT id, username FROM users WHERE id = ? AND UPPER(role) = 'SUPERVISOR' LIMIT 1`,
      [supervisorId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Data supervisor tidak ditemukan" },
        { status: 404 }
      );
    }

    const cleanEmail = email.trim();
    const cleanUsername = username?.trim() || existingRows[0].username || null;

    // 2. Cek duplikasi email / username pada user lain
    const [dupRows] = await pool.execute<RowDataPacket[]>(
      cleanUsername
        ? `SELECT id FROM users WHERE id != ? AND (email = ? OR username = ?) LIMIT 1`
        : `SELECT id FROM users WHERE id != ? AND email = ? LIMIT 1`,
      cleanUsername
        ? [supervisorId, cleanEmail, cleanUsername]
        : [supervisorId, cleanEmail]
    );

    if (dupRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Email atau username sudah digunakan akun lain",
        },
        { status: 409 }
      );
    }

    // 3. Susun query UPDATE dinamis (password opsional)
    const setClauses: string[] = [
      "nama = ?",
      "email = ?",
      "username = ?",
      "no_hp = ?",
      "mitra_id = ?",
      "unit_kerja = ?",
    ];
    const queryParams: unknown[] = [
      nama.trim(),
      cleanEmail,
      cleanUsername,
      no_hp?.trim() || null,
      mitra_id ? Number(mitra_id) : null,
      unit_kerja || null,
    ];

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json(
          { success: false, message: "Password baru minimal 6 karakter" },
          { status: 400 }
        );
      }
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      setClauses.push("password = ?");
      queryParams.push(hashedPassword);
    }

    queryParams.push(supervisorId);

    await pool.execute<ResultSetHeader>(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = ? AND UPPER(role) = 'SUPERVISOR'`,
      queryParams
    );

    // 4. Ambil data terbaru beserta nama_mitra untuk dikembalikan ke state UI
    const [updatedRows] = await pool.execute<SupervisorRow[]>(
      `SELECT 
         u.id, u.nama, u.email, u.username, u.no_hp, u.mitra_id, u.unit_kerja,
         m.nama_mitra
       FROM users u
       LEFT JOIN mitra m ON u.mitra_id = m.id
       WHERE u.id = ?
       LIMIT 1`,
      [supervisorId]
    );

    const row = updatedRows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        nama: row.nama,
        email: row.email,
        username: row.username,
        no_hp: row.no_hp,
        mitra_id: row.mitra_id,
        unit_kerja: row.unit_kerja,
        mitra: row.mitra_id
          ? { id: row.mitra_id, nama_mitra: row.nama_mitra ?? "" }
          : null,
      },
    });
  } catch (error) {
    console.error("PUT /api/supervisors/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat memperbarui data supervisor",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/supervisors/[id] -> Hapus data supervisor
export async function DELETE(
  _req: Request,
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
    if (Number.isNaN(supervisorId)) {
      return NextResponse.json(
        { success: false, message: "ID supervisor tidak valid" },
        { status: 400 }
      );
    }

    await conn.beginTransaction();

    // Lepas relasi pegawai bawahan pada data_non_fronting agar tidak kena FK error
    await conn.execute<ResultSetHeader>(
      `UPDATE data_non_fronting SET supervisor_id = NULL WHERE supervisor_id = ?`,
      [supervisorId]
    );

    const [deleteResult] = await conn.execute<ResultSetHeader>(
      `DELETE FROM users WHERE id = ? AND UPPER(role) = 'SUPERVISOR'`,
      [supervisorId]
    );

    if (deleteResult.affectedRows === 0) {
      await conn.rollback();
      return NextResponse.json(
        { success: false, message: "Data supervisor tidak ditemukan" },
        { status: 404 }
      );
    }

    await conn.commit();

    return NextResponse.json({
      success: true,
      message: "Data supervisor berhasil dihapus",
    });
  } catch (error: unknown) {
    await conn.rollback();
    console.error("DELETE /api/supervisors/[id] error:", error);

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