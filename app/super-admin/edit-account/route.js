import { NextResponse } from "next/server";
import bcrypt from 'bcryptjs';
import { pool } from "@/lib/db";
import nodemailer from "nodemailer";
import { cleanupStoredUploads, storeFileUpload } from "@/lib/uploads";

// Konfigurasi Email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  secure: false, 
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function POST(req) {
  let connection;
  let transactionStarted = false;
  let committed = false;
  const uploads = [];
  try {
    const formData = await req.formData();
    const id = formData.get("id");
    
    if (!id) {
      return NextResponse.json({ success: false, message: "ID Akun tidak valid!" }, { status: 400 });
    }

    // Ambil data baru dari form
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

    // 1. Ambil data lama untuk perbandingan & pengelolaan file
    connection = await pool.getConnection();
    const [oldRecords] = await connection.query(
      "SELECT nama, email, username, password, idcard_file, st_file FROM master_pegawai WHERE id = ?", 
      [id]
    );

    if (oldRecords.length === 0) {
      connection.release();
      return NextResponse.json({ success: false, message: "Data tidak ditemukan" }, { status: 404 });
    }
    const oldData = oldRecords[0];

    // 2. Persiapan Password
    let passwordHash = oldData.password;
    if (rawPassword && rawPassword.trim() !== "") {
      passwordHash = await bcrypt.hash(rawPassword, 10);
    }

    // 3. Penanganan Upload File Baru (Jika ada)
    let idCardName = oldData.idcard_file;
    const idCardFile = formData.get("idcard_file");
    if (idCardFile instanceof File && idCardFile.name && idCardFile.name.trim() !== "" && idCardFile.size > 0) {
      const stored = await storeFileUpload({
        file: idCardFile,
        folder: "",
        localFileName: `idcard_${Date.now()}_${idCardFile.name.replace(/\s+/g, "_")}`,
      });
      uploads.push(stored);
      idCardName = stored.reference;
    }

    // Penanganan Surat Tugas Baru (Jika ada)
    let stFileString = oldData.st_file;
    const stFiles = formData.getAll("st_file");
    const validStFiles = stFiles.filter(f => f instanceof File && f.name.trim() !== "" && f.size > 0).slice(0, 3);
    
    if (validStFiles.length > 0) {
      const savedStFileNames = [];
      for (const file of validStFiles) {
        const stored = await storeFileUpload({
          file,
          folder: "",
          localFileName: `st_${Date.now()}_${file.name.replace(/\s+/g, "_")}`,
        });
        uploads.push(stored);
        savedStFileNames.push(stored.reference);
      }
      stFileString = savedStFileNames.join(",");
    }

    // 4. Mulai Transaksi Database
    await connection.beginTransaction();
    transactionStarted = true;

    // Update tabel users (Gunakan oldData.username untuk pencarian WHERE agar aman jika username diubah)
    await connection.query(
      "UPDATE users SET username = ?, password = ? WHERE username = ?", 
      [username, passwordHash, oldData.username]
    );

    // Update tabel master_pegawai
    await connection.query(
      `UPDATE master_pegawai SET 
       nama=?, nik=?, kanwil=?, area=?, penempatan=?, leader=?, email=?, nowa=?, 
       idcard_file=?, st_file=?, nama_bank=?, norek=?, username=?, password=? 
       WHERE id=?`,
      [nama, nik, kanwil, area, penempatan, leader, email, nowa, idCardName, stFileString, nama_bank, norek, username, passwordHash, id]
    );

    await connection.commit();
    committed = true;
    connection.release();
    connection = null;

    // 5. Kirim Email Notifikasi (Deklarasi hanya 1 kali di sini)
    const usernameChanged = username !== oldData.username;
    const emailChanged = email !== oldData.email;
    const passwordChanged = rawPassword && rawPassword.trim() !== "";

    if (usernameChanged || emailChanged || passwordChanged) {
      try {
        await transporter.sendMail({
          from: `"Admin Sistem" <${process.env.EMAIL_SERVER_USER}>`,
          to: email, 
          subject: "Notifikasi Perubahan Data Akun Fronting",
          html: `
            <h3>Halo ${nama},</h3>
            <p>Admin telah melakukan pembaruan pada akun Anda:</p>
            <ul>
              ${usernameChanged ? `<li>Username baru: <b>${username}</b> (Sebelumnya: ${oldData.username})</li>` : ''}
              ${emailChanged ? `<li>Email baru: <b>${email}</b></li>` : ''}
              {/* Tampilkan rawPassword jika password diubah */}
              ${passwordChanged ? `<li>Password baru: <b>${rawPassword}</b></li>` : ''}
            </ul>
            <p style="color:red;">*Harap login dengan kredensial terbaru Anda dan jaga kerahasiaan password ini.</p>
          `,
        });
      } catch (emailErr) {
        console.error("Gagal kirim email:", emailErr);
      }
    }

    return NextResponse.json({ success: true, message: "Data berhasil diperbarui dan notifikasi dikirim!" });

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
    if (connection) connection.release();
    if (!committed && rolledBack) await cleanupStoredUploads(uploads);
    console.error("Gagal edit akun:", error);
    return NextResponse.json({ success: false, message: "Gagal memperbarui data: " + error.message }, { status: 500 });
  }
}
