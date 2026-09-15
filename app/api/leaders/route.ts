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

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT * FROM data_leader ORDER BY id DESC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ==============================================================
    // 2. KONDISI: SUBMIT MANUAL FORM WEB (ADD / EDIT)
    // ==============================================================
    const { id, namaLeader, kanwil, area, penempatan, email, username, password, idcard_file } = body;
    
    const kanwilStr = JSON.stringify(kanwil || []);
    const areaStr = JSON.stringify(area || []);
    const penempatanStr = JSON.stringify(penempatan || []);

    // --- PROSES FILE BASE64 ID CARD ---
    let idCardName = null;
    if (idcard_file && typeof idcard_file === 'string' && idcard_file.startsWith('data:image')) {
      // Decode Base64
      const matches = idcard_file.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1]; 
        const buffer = Buffer.from(matches[2], 'base64');
        idCardName = `idcard_leader_${Date.now()}.${ext}`;
        
        const uploadDir = path.join(process.cwd(), "public/uploads/leader/idcard");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        // Simpan file fisik
        await writeFile(path.join(uploadDir, idCardName), buffer);
      }
    }

    // --- PROSES UPDATE / EDIT LEADER ---
    if (id) {
      const [oldRows] = await pool.query(
        `SELECT email, username FROM data_leader WHERE id = ?`,
        [id]
      ) as [any, any];

      const oldLeader = oldRows[0] || {};
      const emailChanged = oldLeader.email !== email;
      const usernameChanged = oldLeader.username !== username;
      const passwordChanged = password && password.trim() !== "";

      let hashedPassword = null;
      if (passwordChanged) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      let query = `
        UPDATE data_leader 
        SET nama_leader = ?, kanwil = ?, area = ?, penempatan = ?, email = ?, username = ?
      `;
      let queryParams: any[] = [namaLeader, kanwilStr, areaStr, penempatanStr, email, username];

      if (hashedPassword) {
        query += `, password = ?`;
        queryParams.push(hashedPassword);
      }

      // Update kolom idcard_file HANYA JIKA super admin melampirkan file baru di form edit
      if (idCardName) {
        query += `, idcard_file = ?`;
        queryParams.push(idCardName);
      }

      query += ` WHERE id = ?`;
      queryParams.push(id);

      await pool.query(query, queryParams);

      if (username) {
        try {
          if (hashedPassword) {
            await pool.query(
              `UPDATE users SET password = ?, jabatan = 'leader', role = 'leader' WHERE username = ?`,
              [hashedPassword, username]
            );
          }
        } catch (userErr) {
          console.error("Catatan: Gagal sinkron ke tabel users pusat:", userErr);
        }
      }

      if (emailChanged || usernameChanged || passwordChanged) {
        await sendCredentialsEmail(email, namaLeader, username, password, true);
      }

      return NextResponse.json({ message: "Data leader berhasil diperbarui!" });

    } 
    // --- PROSES INSERT / TAMBAH LEADER BARU DARI FORM ---
    else {
      let hashedPassword = null;
      if (password && password.trim() !== "") {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const query = `
        INSERT INTO data_leader (nama_leader, kanwil, area, penempatan, email, idcard_file, username, password) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [namaLeader, kanwilStr, areaStr, penempatanStr, email, idCardName, username, hashedPassword];

      const [result] = await pool.query(query, values);

      if (username && hashedPassword) {
        try {
          await pool.query(
            `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, 'leader', 'leader') 
             ON DUPLICATE KEY UPDATE password = ?, jabatan = 'leader', role = 'leader'`,
            [username, hashedPassword, hashedPassword]
          );
        } catch (userErr) {
          console.error("Catatan: Gagal insert ke tabel users pusat:", userErr);
        }
      }

      if (email && username) {
        await sendCredentialsEmail(email, namaLeader, username, password, false);
      }

      return NextResponse.json({ message: "Leader berhasil ditambahkan!", data: result });
    }

  } catch (error: any) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data: " + (error.message || error) }, { status: 500 });
  }
}