import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import nodemailer from "nodemailer";
import { cleanupStoredUploads, storeImageDataUrl, type StoredUpload } from "@/lib/uploads";
import { resolveUploadUrl } from "@/lib/mobile/attachment-path";

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
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM data_leader ORDER BY id DESC');
    const leadersWithUrls = await Promise.all(rows.map(async (leader) => ({
      ...leader,
      idcard_file_url: await resolveUploadUrl(leader.idcard_file, "leader/idcard"),
    })));
    return NextResponse.json(leadersWithUrls);
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let upload: StoredUpload | undefined;
  let safeToCleanup = true;
  let committed = false;
  try {
    const body = await req.json();

    // ==============================================================
    // 2. KONDISI: SUBMIT MANUAL FORM WEB (ADD / EDIT)
    // ==============================================================
    const { id, namaLeader, kanwil, area, penempatan, email, username, password, idcard_file } = body;

    const cleanUsername = typeof username === "string" ? username.trim() : "";
    const cleanPassword = typeof password === "string" ? password.trim() : "";

    const kanwilStr = JSON.stringify(kanwil || []);
    const areaStr = JSON.stringify(area || []);
    const penempatanStr = JSON.stringify(penempatan || []);

    // The database column is NOT NULL, while the web and mobile forms allow
    // leaders to be created without an ID-card attachment.
    let idCardName: string | null = "";
    if (idcard_file && typeof idcard_file === 'string' && idcard_file.startsWith('data:image')) {
      const subtype = /^data:image\/([A-Za-z0-9.+-]+);/.exec(idcard_file)?.[1] ?? "img";
      const extension = subtype === "jpeg" ? "jpg" : subtype.split("+")[0].replace(/[^a-zA-Z0-9]/g, "") || "img";
      upload = await storeImageDataUrl({
        dataUrl: idcard_file,
        folder: "leader/idcard",
        localFileName: `idcard_leader_${Date.now()}.${extension}`,
      });
      idCardName = upload.reference;
    }

    // --- PROSES UPDATE / EDIT LEADER ---
    if (id) {
      const [oldRows] = await pool.query(
        `SELECT email, username, password FROM data_leader WHERE id = ?`,
        [id]
      ) as [any, any];

      const oldLeader = oldRows[0];
      if (!oldLeader) {
        if (upload) await cleanupStoredUploads([upload]);
        return NextResponse.json({ error: "Leader tidak ditemukan" }, { status: 404 });
      }

      const oldUsername = typeof oldLeader.username === "string" ? oldLeader.username.trim() : "";
      const isCreatingNewAccount = !oldUsername && Boolean(cleanUsername);

      const emailChanged = (oldLeader.email || "") !== (email || "");
      const usernameChanged = oldUsername !== cleanUsername;
      const passwordChanged = cleanPassword !== "";

      // Jika username sebelumnya kosong dan sekarang diisi, password wajib ada untuk INSERT ke tabel users
      if (isCreatingNewAccount && !passwordChanged && !oldLeader.password) {
        if (upload) await cleanupStoredUploads([upload]);
        return NextResponse.json(
          { error: "Password wajib diisi saat membuat username baru untuk Leader" },
          { status: 400 }
        );
      }

      let hashedPassword: string | null = null;
      if (passwordChanged) {
        hashedPassword = await bcrypt.hash(cleanPassword, 10);
      }

      const finalPasswordForUser = hashedPassword || oldLeader.password;

      let query = `
        UPDATE data_leader 
        SET nama_leader = ?, kanwil = ?, area = ?, penempatan = ?, email = ?, username = ?
      `;
      const queryParams: any[] = [
        namaLeader,
        kanwilStr,
        areaStr,
        penempatanStr,
        email,
        cleanUsername || null,
      ];

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

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Cek ketersediaan username di tabel users jika membuat username baru atau mengganti username
        if (cleanUsername && usernameChanged) {
          const [existingUsers] = await connection.query(
            `SELECT username FROM users WHERE username = ? LIMIT 1`,
            [cleanUsername]
          ) as [Array<{ username: string }>, unknown];

          if (existingUsers.length > 0) {
            await connection.rollback();
            if (upload) await cleanupStoredUploads([upload]);
            return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
          }
        }

        await connection.query(query, queryParams);

        if (isCreatingNewAccount) {
          // Username sebelumnya kosong -> INSERT baris baru ke tabel users
          await connection.query(
            `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, 'leader', 'leader')`,
            [cleanUsername, finalPasswordForUser]
          );
        } else if (oldUsername && cleanUsername) {
          // Username sebelumnya sudah ada -> cek apakah barisnya ada di tabel users
          const [userRows] = await connection.query(
            `SELECT id FROM users WHERE username = ? LIMIT 1`,
            [oldUsername]
          ) as [Array<{ id: number }>, unknown];

          if (userRows.length > 0) {
            if (hashedPassword) {
              await connection.query(
                `UPDATE users SET username = ?, password = ?, jabatan = 'leader', role = 'leader' WHERE username = ?`,
                [cleanUsername, hashedPassword, oldUsername]
              );
            } else {
              await connection.query(
                `UPDATE users SET username = ?, jabatan = 'leader', role = 'leader' WHERE username = ?`,
                [cleanUsername, oldUsername]
              );
            }
          } else if (finalPasswordForUser) {
            await connection.query(
              `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, 'leader', 'leader')`,
              [cleanUsername, finalPasswordForUser]
            );
          }
        }

        await connection.commit();
        committed = true;
      } catch (error) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          safeToCleanup = false;
          console.error("Unable to roll back leader update", rollbackError);
        }
        throw error;
      } finally {
        connection.release();
      }

      if (cleanUsername && (emailChanged || usernameChanged || passwordChanged)) {
        await sendCredentialsEmail(email, namaLeader, cleanUsername, cleanPassword, true);
      }

      return NextResponse.json({ message: "Data leader berhasil diperbarui!" });
    }

    // --- PROSES INSERT / TAMBAH LEADER BARU DARI FORM ---
    else {
      if (!cleanUsername || !cleanPassword) {
        if (upload) await cleanupStoredUploads([upload]);
        return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
      }
      const hashedPassword = await bcrypt.hash(cleanPassword, 10);

      const query = `
        INSERT INTO data_leader (nama_leader, kanwil, area, penempatan, email, idcard_file, username, password) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [namaLeader, kanwilStr, areaStr, penempatanStr, email, idCardName, cleanUsername, hashedPassword];

      const connection = await pool.getConnection();
      let result;
      try {
        await connection.beginTransaction();
        const [existingUsers] = await connection.query(
          `SELECT username FROM users WHERE username = ? LIMIT 1`,
          [cleanUsername]
        ) as [Array<{ username: string }>, unknown];
        if (existingUsers.length) {
          await connection.rollback();
          if (upload) await cleanupStoredUploads([upload]);
          return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
        }
        [result] = await connection.query(query, values);
        await connection.query(
          `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, 'leader', 'leader')`,
          [cleanUsername, hashedPassword]
        );
        await connection.commit();
        committed = true;
      } catch (error) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          safeToCleanup = false;
          console.error("Unable to roll back leader creation", rollbackError);
        }
        throw error;
      } finally {
        connection.release();
      }

      if (email && cleanUsername) {
        await sendCredentialsEmail(email, namaLeader, cleanUsername, cleanPassword, false);
      }

      return NextResponse.json({ message: "Leader berhasil ditambahkan!", data: result });
    }
  } catch (error: any) {
    if (!committed && safeToCleanup && upload) await cleanupStoredUploads([upload]);
    console.error("Database Error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data: " + (error.message || error) }, { status: 500 });
  }
}