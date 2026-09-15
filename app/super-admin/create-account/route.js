import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcrypt";
import { pool } from "@/lib/db";
import nodemailer from "nodemailer";

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

    for (const file of stFiles) {
      if (file && typeof file === "object" && file.name && file.name.trim() !== "") {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const fileName = `st_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const filePath = path.join(process.cwd(), "public/uploads", fileName);

        await writeFile(filePath, buffer);
        savedStFileNames.push(fileName);
      }
    }

    // Batasi maksimal hanya 3 file yang diambil
    const finalStFiles = savedStFileNames.slice(0, 3);
    const stFileString = finalStFiles.join(",");

    // Tangkap file ID Card
    const idCardFile = formData.get("idcard_file");
    let idCardName = "";
    if (idCardFile && typeof idCardFile === "object" && idCardFile.name) {
      const bytes = await idCardFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      idCardName = `idcard_${Date.now()}_${idCardFile.name.replace(/\s+/g, "_")}`;
      await writeFile(path.join(process.cwd(), "public/uploads", idCardName), buffer);
    }

    // Mulai Transaksi Database
    connection = await pool.getConnection();
    await connection.beginTransaction();

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
    console.error("Gagal membuat akun:", error);
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server: " + error.message }, { status: 500 });
  } finally {
    // Wajib lepaskan koneksi kembali ke pool
    if (connection) connection.release();
  }
}