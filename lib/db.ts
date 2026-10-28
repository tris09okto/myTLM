/*import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'mytlm_user',
  password: 'mytlm2026!@',
  database: 'db_mytlm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});*/

import mysql from 'mysql2/promise';

// Mendeklarasikan tipe global agar TypeScript tidak komplain saat menempelkan pool ke globalThis
const globalForMysql = globalThis as unknown as {
  pool: mysql.Pool | undefined;
};

export const pool =
  globalForMysql.pool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    
    // Konfigurasi penting untuk hemat koneksi
    waitForConnections: true,
    connectionLimit: 5,       // Batasi maksimal koneksi bersamaan (misal: 5-10)
    queueLimit: 0,
    enableKeepAlive: true,    // Jaga koneksi tetap hidup agar tidak perlu jabat tangan TCP ulang
    keepAliveInitialDelay: 10000,
    idleTimeout: 60000,       // Rilis koneksi idle setelah 60 detik
  });

if (process.env.NODE_ENV !== 'production') {
  globalForMysql.pool = pool;
}