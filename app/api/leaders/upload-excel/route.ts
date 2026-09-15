import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; 
import bcrypt from 'bcrypt'; 
import nodemailer from "nodemailer";
import { writeFile } from "fs/promises";
import path from "path";
import fs from "fs";

// Konfigurasi Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_SERVER_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

// Fungsi pembantu untuk mengirim email kredensial
async function sendCredentialsEmail(toEmail: string, nama: string, username: string, passwordPlain: string, isUpdate: boolean) {
  if (!toEmail) return;
  try {
    const subject = isUpdate ? 'Pemberitahuan Perubahan Akun & Kredensial Leader' : 'Informasi Akun Login Leader Baru';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; color: #333; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <h2 style="color: #2563eb; margin-top: 0;">Halo, ${nama}</h2>
        <p>${isUpdate ? 'Data atau kredensial akun login Anda telah diperbarui oleh Super Admin.' : 'Akun login Anda sebagai Leader telah berhasil didaftarkan ke dalam sistem.'}</p>
        <p>Berikut adalah detail informasi akun Anda untuk mengakses sistem:</p>
        
        <div style="background: #f8fafc; padding: 15px 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Username:</strong> <span style="color: #1e40af; font-family: monospace;">${username}</span></p>
          <p style="margin: 8px 0;"><strong>Password:</strong> <span style="color: #1e40af; font-family: monospace;">${passwordPlain || '(Password tidak diubah dari sebelumnya)'}</span></p>
          <p style="margin: 8px 0;"><strong>Email:</strong> <span style="color: #1e40af;">${toEmail}</span></p>
        </div>

        <p style="font-size: 13px; color: #64748b;">Silakan gunakan informasi di atas untuk masuk (login) ke dalam sistem. Harap jaga kerahasiaan akun Anda.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">Pesan otomatis dari Sistem Super Admin.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Super Admin System" <${process.env.EMAIL_SERVER_USER}>`,
      to: toEmail,
      subject,
      html,
    });
  } catch (error) {
    console.error("Gagal mengirim email notifikasi:", error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ==============================================================
    // 1. KONDISI: UPLOAD EXCEL (BULK INSERT)
    // ==============================================================
    if (Array.isArray(body)) {
      for (const item of body) {
        let hashedPassword = null;
        if (item.password) {
          hashedPassword = await bcrypt.hash(String(item.password), 10);
        }

        const namaLeader = item.namaLeader || "-";
        const kanwilStr = JSON.stringify(item.kanwil || []);
        const areaStr = JSON.stringify(item.area || []);
        const penempatanStr = JSON.stringify(item.penempatan || []);
        const email = item.email || null;
        const username = item.username || null;
        const plainPassword = item.password || "";

        // Cek data yang sudah ada
        const [existing] = await pool.query(
          `SELECT id FROM data_leader WHERE username = ?`, 
          [username]
        ) as [any, any];

        if (existing.length > 0) {
          // Update (tanpa merubah idcard_file jika sebelumnya ada)
          await pool.query(
            `UPDATE data_leader SET nama_leader = ?, kanwil = ?, area = ?, penempatan = ?, email = ?, password = COALESCE(?, password) WHERE username = ?`,
            [namaLeader, kanwilStr, areaStr, penempatanStr, email, hashedPassword, username]
          );
        } else {
          // Insert Baru (idcard_file dikosongkan secara default menjadi NULL)
          await pool.query(
            `INSERT INTO data_leader (nama_leader, kanwil, area, penempatan, email, username, password, idcard_file) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
            [namaLeader, kanwilStr, areaStr, penempatanStr, email, username, hashedPassword]
          );
        }

        if (username && hashedPassword) {
          try {
            await pool.query(
              `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, 'leader', 'leader') 
               ON DUPLICATE KEY UPDATE password = ?, jabatan = 'leader', role = 'leader'`,
              [username, hashedPassword, hashedPassword]
            );
            await sendCredentialsEmail(email, namaLeader, username, plainPassword, false);
          } catch (userErr) {
            console.error("Catatan: Gagal sinkron excel ke tabel users:", userErr);
          }
        }
      }

      return NextResponse.json({ message: "Data Excel berhasil diimport!" });
    }

  } catch (error: any) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data: " + (error.message || error) }, { status: 500 });
  }
}