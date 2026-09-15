// app/api/chat-save/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route'; 
import {pool} from '@/lib/db'; 

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const userId = session.user.name;
    const { chatArray } = await req.json();

    if (!chatArray || chatArray.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Ubah array object menjadi String JSON untuk disimpan ke DB
    const stringifiedArray = JSON.stringify(chatArray);

    // Query UPSERT (Update or Insert) MySQL
    await pool.query(
      `INSERT INTO chat_history_array (user_id, messages) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE messages = ?`,
      [userId, stringifiedArray, stringifiedArray]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving chat array:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}