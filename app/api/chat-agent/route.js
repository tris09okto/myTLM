import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
// Sesuaikan path import ini ke file nextauth Anda
import { authOptions } from '../auth/[...nextauth]/route'; 
// Sesuaikan path import ini ke file koneksi database Anda (misal mysql2/promise)
import {pool} from '@/lib/db'; 

export async function POST(req) {
  try {
    // Tangkap array 'messages' yang dikirim dari frontend
    const { messages } = await req.json();

    // Format pesan sesuai standar Vercel AI SDK (role: 'user' | 'assistant', content: string)
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'agent' ? 'assistant' : 'user',
      content: msg.text
    }));

    // Generate balasan dari AI menggunakan Vercel AI SDK
    const { text } = await generateText({
      model: google('gemini-3.6-flash'), // Tetap gunakan model yang Anda tentukan
      system: 'Anda adalah asisten AI internal perusahaan. Jawablah pertanyaan dari pegawai dengan sopan, akurat, informatif, dan profesional.',
      // Gunakan 'messages' alih-alih 'prompt' agar AI tahu history percakapan
      messages: formattedMessages, 
    });

    // 7. Kembalikan data JSON ke frontend
    return NextResponse.json({ 
      success: true, 
      reply: text 
    });

  } catch (error) {
    console.error("Error Chat Agent:", error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server agent saat menghubungi AI.' }, 
      { status: 500 }
    );
  }
}