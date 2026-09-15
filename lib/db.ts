import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'mytlm_user',
  password: 'mytlm2026!@',
  database: 'db_mytlm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});