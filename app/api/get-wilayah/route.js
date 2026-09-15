// file: app/api/get-wilayah/route.js
import { NextResponse } from 'next/server';
import {pool} from '@/lib/db'; // Sesuaikan path jika folder lib ada di tempat lain

export async function GET() {
  try {
    // Query untuk mengambil field yang dibutuhkan saja agar ringan
    const query = 'SELECT kanwil, area, penempatan FROM master_wilayah';
    const [rows] = await pool.query(query);

    // Mengembalikan response sesuai format yang diharapkan oleh frontend
    return NextResponse.json({
      success: true,
      data: rows
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching master_wilayah:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Gagal mengambil data master wilayah dari database'
    }, { status: 500 });
  }
}