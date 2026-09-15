import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { writeFile } from 'fs/promises';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { sendAccountNotification } from '@/lib/mailer'; // <-- Import helper email

export async function POST(req) {
  let connection;
  try {
    const formData = await req.formData();
    
    // Pemetaan Data Form Teks
    const nama = formData.get('nama');
    const nik = formData.get('nik');
    const unit_kerja = formData.get('unit_kerja');
    const jenis_kelamin = formData.get('jenis_kelamin');
    const area_penempatan = formData.get('area_penempatan');
    const alamat_area_penempatan = formData.get('alamat_area_penempatan');
    const status_pernikahan = formData.get('status_pernikahan');
    const golongan_darah = formData.get('golongan_darah') || '';
    const masa_kerja = formData.get('masa_kerja');
    const tanggal_mulai_kerja = formData.get('tanggal_mulai_kerja') || null;
    const masa_kontrak = formData.get('masa_kontrak') || '';
    const jabatan = formData.get('jabatan');
    const domisili = formData.get('domisili');
    const email = formData.get('email');
    const tempat_lahir = formData.get('tempat_lahir');
    const tanggal_lahir = formData.get('tanggal_lahir');
    const no_whatsapp = formData.get('no_whatsapp');
    const username = formData.get('username');
    const plainPassword = formData.get('password'); // Password asli dari input form

    // -- 2. ENCRYPT PASSWORD MENGGUNAKAN BCRYPT --
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    // Folder Uploads Setup
    const uploadDirFoto = path.join(process.cwd(), 'public/uploads/pas_foto');
    const uploadDirST = path.join(process.cwd(), 'public/uploads/surat_tugas');
    if (!fs.existsSync(uploadDirFoto)) fs.mkdirSync(uploadDirFoto, { recursive: true });
    if (!fs.existsSync(uploadDirST)) fs.mkdirSync(uploadDirST, { recursive: true });

    // File Upload: Pas Foto
    const pasFoto = formData.get('pas_foto');
    let fotoName = null;
    if (pasFoto && pasFoto !== 'null') {
      const bufferFoto = Buffer.from(await pasFoto.arrayBuffer());
      fotoName = `FOTO_${Date.now()}_${nik}_${pasFoto.name.replace(/\s+/g, '_')}`;
      await writeFile(path.join(uploadDirFoto, fotoName), bufferFoto);
    }

    // File Upload: Surat Tugas
    const suratTugas = formData.get('surat_tugas');
    let stName = null;
    if (suratTugas && suratTugas !== 'null') {
      const bufferST = Buffer.from(await suratTugas.arrayBuffer());
      stName = `ST_${Date.now()}_${nik}_${suratTugas.name.replace(/\s+/g, '_')}`;
      await writeFile(path.join(uploadDirST, stName), bufferST);
    }

    // Tentukan role login berdasarkan Unit Kerja
    let loginRole = '';
    let insertJabatan = '';
    if (jabatan === 'SPV') {
      loginRole = 'supervisor';
      insertJabatan = 'supervisor';
    } else if (jabatan === 'PEGAWAI') {
      loginRole = 'pegawai';
      insertJabatan = 'non-fronting';
    }
    
    /*if (['SECURITY', 'DRIVER'].includes(unit_kerja)) insertJabatan = 'security';
    if (['OFFICE BOY', 'CS ( CLEANING SERVICE)'].includes(unit_kerja)) insertJabatan = 'obcs';
    if (['TEKNISI'].includes(unit_kerja)) insertJabatan = 'teknisi';*/

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Cek Ketersediaan Username
    const [existingUser] = await connection.query(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existingUser.length > 0) {
      await connection.rollback();
      return NextResponse.json({ success: false, message: 'Username sudah digunakan!' }, { status: 400 });
    }

    // 2. Simpan Kredensial Login
    await connection.query(
      `INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, ?, ?)`,
      [username, hashedPassword, insertJabatan, loginRole]
    );

    // 3. Simpan Profil Lengkap
    await connection.query(
      `INSERT INTO data_non_fronting 
      (nama, nik, unit_kerja, jenis_kelamin, area_penempatan, alamat_area_penempatan, status_pernikahan, golongan_darah, masa_kerja, tanggal_mulai_kerja, masa_kontrak, jabatan, domisili, email, tempat_lahir, tanggal_lahir, no_whatsapp, pas_foto, surat_tugas, username, password) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nama, nik, unit_kerja, jenis_kelamin, area_penempatan, alamat_area_penempatan, status_pernikahan, golongan_darah, masa_kerja, tanggal_mulai_kerja, masa_kontrak, jabatan, domisili, email, tempat_lahir, tanggal_lahir, no_whatsapp, fotoName, stName, username, hashedPassword]
    );

    await connection.commit();

    // --- KIRIM EMAIL PEMBERITAHUAN KE PEGAWAI ---
    if (email) {
      // Mengirim email secara异步 (tidak memblokir respons sukses jika terjadi jeda jaringan)
      sendAccountNotification(email, nama, username, plainPassword, unit_kerja).catch(err => {
        console.error("Background email error:", err);
      });
    }

    return NextResponse.json({ success: true, message: `Akun ${unit_kerja} berhasil dibuat dan email pemberitahuan dikirim!` });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error create non-fronting:', error);
    return NextResponse.json({ success: false, message: 'Kesalahan sistem.', error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}