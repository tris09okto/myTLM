import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan dengan koneksi database Anda (misal mysql2/pool)
// Jika menggunakan NextAuth untuk autentikasi:
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Sesuaikan path authOptions Anda

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Ambil identitas user yang sedang login (role/jabatan dan NIK jika ada)
    const userRole = (session.user as any).jabatan || (session.user as any).role || 'Keuangan';
    const userNik = (session.user as any).nik || '';

    // Query untuk mengambil pesan di mana penerima adalah NIK user, ROLE user, atau 'ALL'
    // Menggunakan parameterized query untuk keamanan dari SQL Injection
    const query = `
      SELECT * FROM pesan_notifikasi 
      WHERE penerima_nik = ? 
         OR penerima_nik = ? 
         OR penerima_nik = 'ALL'
      ORDER BY created_at DESC
    `;

    // Eksekusi query database (contoh menggunakan mysql2 promise pool)
    const [rows]: any = await pool.query(query, [userRole, userNik]);

    return NextResponse.json({
      success: true,
      data: rows
    });

  } catch (error: any) {
    console.error("Error fetching inbox:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}