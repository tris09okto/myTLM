import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { cleanupStoredUploads, storeFileUpload } from '@/lib/uploads';
import path from 'node:path';

// Helper untuk membersihkan ekstensi ganda (.jpg.jpg -> .jpg, .pdf.pdf -> .pdf)
const sanitizeDoubleExtension = (fileRef: string | null | undefined): string => {
  if (!fileRef || String(fileRef).trim() === '') return '';
  return String(fileRef).trim().replace(/(\.[a-zA-Z0-9]+)\1$/i, '$1');
};

export async function POST(req: Request) {
  let connection;
  let transactionStarted = false;
  let committed = false;
  const uploads: any[] = [];

  try {
    const formData = await req.formData();
    
    const id = formData.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Pegawai wajib disertakan!' },
        { status: 400 }
      );
    }

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
    const supervisor = formData.get('supervisor') || null;
    const plainPassword = formData.get('password'); // Opsional jika diganti
    const id_mitra = formData.get('id_mitra') || null;

    const pasFoto = formData.get('pas_foto');
    const suratTugas = formData.get('surat_tugas');

    connection = await pool.getConnection();

    // 1. Ambil data lama pegawai dari database
    const [existingRows]: any = await connection.query(
      `SELECT * FROM data_non_fronting WHERE id = ?`,
      [id]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data pegawai tidak ditemukan!' },
        { status: 404 }
      );
    }

    const currentData = existingRows[0];

    // File Upload: Pas Foto
    // Bersihkan nilai lama jika tidak ada upload baru
    let fotoName = sanitizeDoubleExtension(currentData.pas_foto);

    if (pasFoto instanceof File && pasFoto.size > 0) {
      // Ambil nama file tanpa ekstensi bawaan agar tidak terduplikasi saat upload
      const cleanFileName = path.parse(pasFoto.name).name.replace(/\s+/g, '_');

      const stored = await storeFileUpload({
        file: pasFoto,
        folder: 'pas_foto',
        localFileName: `FOTO_${Date.now()}_${nik}_${cleanFileName}`,
      });
      uploads.push(stored);
      fotoName = sanitizeDoubleExtension(stored.reference);
    }

    // File Upload: Surat Tugas
    // Bersihkan nilai lama jika tidak ada upload baru
    let stName = sanitizeDoubleExtension(currentData.surat_tugas);

    if (suratTugas instanceof File && suratTugas.size > 0) {
      // Ambil nama file tanpa ekstensi bawaan agar tidak terduplikasi saat upload
      const cleanSTFileName = path.parse(suratTugas.name).name.replace(/\s+/g, '_');

      const stored = await storeFileUpload({
        file: suratTugas,
        folder: 'surat_tugas',
        localFileName: `ST_${Date.now()}_${nik}_${cleanSTFileName}`,
        resourceType: 'raw',
      });
      uploads.push(stored);
      stName = sanitizeDoubleExtension(stored.reference);
    }

    // Tentukan Hashing Password jika password diisi
    let hashedPassword = currentData.password;
    if (plainPassword && String(plainPassword).trim() !== '') {
      hashedPassword = await bcrypt.hash(String(plainPassword), 10);
    }

    // Tentukan Role & Jabatan Login
    let loginRole = '';
    let insertJabatan = '';
    if (jabatan === 'SPV') {
      loginRole = 'supervisor';
      insertJabatan = 'supervisor';
    } else if (jabatan === 'PEGAWAI') {
      loginRole = 'pegawai';
      insertJabatan = 'non-fronting';
    }

    await connection.beginTransaction();
    transactionStarted = true;

    // 2. Update Kredensial Login di tabel users
    await connection.query(
      `UPDATE users SET password = ?, jabatan = ?, role = ? WHERE username = ?`,
      [hashedPassword, insertJabatan, loginRole, currentData.username]
    );

    // 3. Update Profil Lengkap di tabel data_non_fronting
    await connection.query(
      `UPDATE data_non_fronting SET 
        nama = ?, nik = ?, unit_kerja = ?, jenis_kelamin = ?, area_penempatan = ?, 
        alamat_area_penempatan = ?, status_pernikahan = ?, golongan_darah = ?, 
        masa_kerja = ?, tanggal_mulai_kerja = ?, masa_kontrak = ?, jabatan = ?, 
        domisili = ?, email = ?, tempat_lahir = ?, tanggal_lahir = ?, no_whatsapp = ?, 
        pas_foto = ?, surat_tugas = ?, password = ?, supervisor = ?, id_mitra = ? 
       WHERE id = ?`,
      [
        nama, nik, unit_kerja, jenis_kelamin, area_penempatan,
        alamat_area_penempatan, status_pernikahan, golongan_darah,
        masa_kerja, tanggal_mulai_kerja, masa_kontrak, jabatan,
        domisili, email, tempat_lahir, tanggal_lahir, no_whatsapp,
        fotoName, stName, hashedPassword, supervisor, id_mitra,
        id
      ]
    );

    await connection.commit();
    committed = true;

    return NextResponse.json({
      success: true,
      message: `Data pegawai ${nama} berhasil diperbarui!`,
    });

  } catch (error: any) {
    if (connection && transactionStarted && !committed) {
      await connection.rollback();
    }
    if (!committed) await cleanupStoredUploads(uploads);
    console.error('Error update non-fronting:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui data pegawai.', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}