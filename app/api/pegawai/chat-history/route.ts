import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route'; 
import {pool} from '@/lib/db'; 

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const userId = session.user.name;

    // Ambil 1 baris saja dari database
    const [rows]: any = await pool.query(
      `SELECT messages FROM chat_history_array WHERE user_id = ?`,
      [userId]
    );

    if (rows.length > 0 && rows[0].messages) {
      // Pastikan data di-parse dari String/JSON ke bentuk Array Object
      const parsedMessages = typeof rows[0].messages === 'string' 
        ? JSON.parse(rows[0].messages) 
        : rows[0].messages;

      return NextResponse.json({ success: true, data: parsedMessages });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    console.error("Error fetching chat array:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}