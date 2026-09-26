import { NextResponse } from "next/server";
import bcrypt from 'bcryptjs';
import { pool } from "@/lib/db";
import nodemailer from "nodemailer";
import { cleanupStoredUploads, storeFileUpload } from "@/lib/uploads";

// Konfigurasi Nodemailer menggunakan variabel dari .env Anda
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,     // smtp.gmail.com
  port: Number(process.env.EMAIL_SERVER_PORT), // 587
  secure: false,                           // false untuk port 587 (TLS), true untuk port 465
  auth: {
    user: process.env.EMAIL_SERVER_USER,   // tris.oktoriani@gmail.com
    pass: process.env.EMAIL_SERVER_PASSWORD, // yjoq teaf bmmr xvxp
  },
});

export async function POST(req) {

  let connection = null;
  let transactionStarted = false;
  let committed = false;
  const uploads = [];

  try {
    const formData = await req.formData();
    
    const nama = formData.get("nama");
    const nik = formData.get("nik");
    const kanwil = formData.get("kanwil");
    const area = formData.get("area");
    const penempatan = formData.get("penempatan");
    const leader = formData.get("leader");
    const email = formData.get("email");
    const nowa = formData.get("nowa");
    const nama_bank = formData.get("nama_bank");
    const norek = formData.get("norek") || 0;
    const username = formData.get("username");
    const rawPassword = formData.get("password");
    
    const password = rawPassword ? await bcrypt.hash(rawPassword, 10) : "";

    // Tangkap SEMUA file Surat Tugas (Filter file yang benar-benar ada namanya)
    const stFiles = formData.getAll("st_file");
    const savedStFileNames = [];

    const validStFiles = stFiles.filter((value) => value instanceof File && value.name.trim() && value.size > 0).slice(0, 3);
    for (const file of validStFiles) {
      const stored = await storeFileUpload({
        file,
        folder: "",
        localFileName: `st_${Date.now()}_${file.name.replace(/\s+/g, "_")}`,
      });
      uploads.push(stored);
      savedStFileNames.push(stored.reference);
    }

    const stFileString = savedStFileNames.join(",");

    // Tangkap file ID Card
    const idCardFile = formData.get("idcard_file");
    let idCardName = "";
    if (idCardFile instanceof File && idCardFile.name && idCardFile.size > 0) {
      const stored = await storeFileUpload({
        file: idCardFile,
        folder: "",
        localFileName: `idcard_${Date.now()}_${idCardFile.name.replace(/\s+/g, "_")}`,
      });
      uploads.push(stored);
      idCardName = stored.reference;
    }

    // Mulai Transaksi Database
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // 2. Insert ke tabel `users` (Default jabatan: 'fronting', role: 'pegawai')
    await connection.query(
      `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, 'fronting', 'pegawai')`,
      [username, password]
    );

    // 3. Insert ke tabel `master_pegawai`
    await connection.query(
      `INSERT INTO master_pegawai 
      (nama, nik, kanwil, area, penempatan, leader, email, nowa, idcard_file, st_file, nama_bank, norek, jenis_pegawai, username, password) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nama, nik, kanwil, area, penempatan, leader, email, nowa, idCardName, stFileString, nama_bank, norek, 'fronting', username, password]
    );

    // Commit transaksi database jika semua query berhasil
    await connection.commit();
    committed = true;

    await transporter.sendMail({
      from: `"Admin Sistem" <${process.env.EMAIL_FROM}>`, // noreply@perusahaan.com
      to: email, // Email pegawai
      subject: "Akun Fronting Baru Anda",
      html: `
        <h3>Halo, ${nama}!</h3>
        <p>Akun fronting Anda telah berhasil dibuat oleh Admin.</p>
        <p>Berikut adalah detail login Anda:</p>
        <ul>
          <li><b>Username:</b> ${username}</li>
          <li><b>Password:</b> ${rawPassword}</li>
        </ul>
        <p style="color: red;"><b>Penting:</b> Mohon segera lakukan login dan ganti password Anda demi keamanan.</p>
      `,
    });

    return NextResponse.json({ success: true, message: "Akun, data pegawai, dan file Surat Tugas berhasil disimpan!" });
    
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Gagal membatalkan transaksi akun:", rollbackError);
      }
    }
    if (!committed && rolledBack) await cleanupStoredUploads(uploads);
    console.error("Gagal membuat akun:", error);
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server: " + error.message }, { status: 500 });
  } finally {
    // Wajib lepaskan koneksi kembali ke pool
    if (connection) connection.release();
  }
}
