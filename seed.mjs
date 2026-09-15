import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

// 1. Konfigurasi koneksi database Anda (Sesuaikan dengan milik Anda)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'mytlm_user',
  password: 'mytlm2026!@', // Ganti dengan password MySQL Anda
  database: 'db_mytlm',        // Ganti dengan nama database Anda
});

async function seedUsers() {
  try {
    // 2. Daftar user yang akan dimasukkan
    const users = [
      {
        username: 'superadmin',
        password: 'password123', // Ini password yang akan diketik saat login
        jabatan: 'super admin',
        role: 'super_admin'
      },
      {
        username: 'adminhrd',
        password: 'password123',
        jabatan: 'HRD',
        role: 'admin'
      },
      {
        username: 'pegawai01',
        password: 'password123',
        jabatan: 'pegawai',
        role: 'pegawai'
      }
    ];

    console.log('Memulai proses penambahan user...');

    for (const user of users) {
      // Cek apakah username sudah ada untuk mencegah duplikasi
      const [existingUser] = await pool.query(
        'SELECT id FROM users WHERE username = ?',
        [user.username]
      );

      if (existingUser.length > 0) {
        console.log(`User ${user.username} sudah ada di database. Melewati...`);
        continue;
      }

      // 3. Hash password menggunakan bcrypt dengan tingkat kerumitan (salt rounds) = 10
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // 4. Masukkan ke database
      await pool.query(
        'INSERT INTO users (username, password, jabatan, role) VALUES (?, ?, ?, ?)',
        [user.username, hashedPassword, user.jabatan, user.role]
      );

      console.log(`Berhasil menambahkan user: ${user.username} (Role: ${user.role})`);
    }

    console.log('Proses selesai!');
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    // Tutup koneksi database
    await pool.end();
  }
}

seedUsers();