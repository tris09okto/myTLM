import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
  let connection = null;
  let transactionStarted = false;
  let committed = false;

  try {
    const body = await req.json();
    const { 
      kode_mitra, 
      nama_mitra, 
      email, 
      no_telp, 
      alamat_mitra, 
      username, 
      password: rawPassword,
      status = "ACTIVE"
    } = body;

    // 1. Validasi Input Wajib
    if (!kode_mitra || !nama_mitra || !email || !no_telp || !alamat_mitra || !username || !rawPassword) {
      return NextResponse.json(
        { success: false, message: "Seluruh kolom data dan akun login wajib diisi!" },
        { status: 400 }
      );
    }

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // 3. Cek Ketersediaan Username di Tabel users
    const [existingUser] = await connection.query(
      `SELECT id FROM users WHERE username = ?`,
      [username]
    );

    if (existingUser.length > 0) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, message: "Username sudah digunakan!" },
        { status: 400 }
      );
    }

    // 4. Cek Ketersediaan Kode Mitra di Tabel mitra
    const [existingKode] = await connection.query(
      `SELECT id FROM mitra WHERE kode_mitra = ?`,
      [kode_mitra]
    );

    if (existingKode.length > 0) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, message: "Kode Mitra sudah terdaftar dalam sistem!" },
        { status: 400 }
      );
    }

    // 5. Insert Kredensial Login ke Tabel users (jabatan: 'mitra', role: 'mitra')
    await connection.query(
      `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, ?, ?)`,
      [username, hashedPassword, "mitra", "mitra"]
    );

    // 6. Insert Data Profil Mitra ke Tabel mitra
    await connection.query(
      `INSERT INTO mitra (kode_mitra, nama_mitra, username, password, email, no_telp, alamat_mitra, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [kode_mitra, nama_mitra, username, hashedPassword, email, no_telp, alamat_mitra, status]
    );

    await connection.commit();
    committed = true;

    return NextResponse.json({
      success: true,
      message: "Data Mitra dan akun login berhasil disimpan!",
    });

  } catch (error) {
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("Rollback error:", rbErr);
      }
    }
    console.error("Error creating mitra:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server: " + error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}