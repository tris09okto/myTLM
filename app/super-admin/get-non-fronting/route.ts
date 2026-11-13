import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  let connection;
  try {
    connection = await pool.getConnection();
    // 💡 Wajib SELECT * agar seluruh 25+ kolom terbawa ke Frontend
    const [rows] = await connection.query(
      `SELECT * FROM data_non_fronting ORDER BY id DESC`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}