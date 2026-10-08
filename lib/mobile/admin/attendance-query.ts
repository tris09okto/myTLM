import type { RowDataPacket } from "mysql2";

import { pool } from "@/lib/db";

export async function getAdminAttendanceRows(month: string) {
  const [attendance] = await pool.query<RowDataPacket[]>(
    `SELECT nik, nama, unit_kerja, nama_supervisor, DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal, waktu_masuk,
            waktu_keluar, lokasi, status FROM absensi
     WHERE DATE_FORMAT(tanggal, '%Y-%m') = ?
     ORDER BY tanggal ASC, waktu_masuk ASC`,
    [month],
  );
  return attendance;
}
