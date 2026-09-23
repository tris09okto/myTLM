// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateUser, parseCredentials } from "@/lib/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          // 1. Parse kredensial
          const parsedCredentials = parseCredentials(credentials);
          if (!parsedCredentials) {
            console.error("DEBUG AUTH: Kredensial gagal diparsing.");
            return null;
          }

          // 2. Autentikasi ke database
          const user = await authenticateUser(parsedCredentials);
          
          if (!user) {
            console.error("DEBUG AUTH: Kredensial tidak cocok atau user tidak ada.");
            return null;
          }

          // 3. Mapping data (Wajib di dalam blok try)
          // NextAuth mewajibkan 'id' bertipe string agar JWT bisa di-encode
          return {
            id: String(user.id),
            name: user.username,
            role: user.role,
            jabatan: user.jabatan,
          };

        } catch (error) {
          // Menangkap error database (misal: timeout, ECONNREFUSED)
          console.error("DEBUG AUTH FATAL ERROR:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Tipe 'user' di sini sekarang berasal dari return blok try di atas
        token.role = (user as any).role;
        token.jabatan = (user as any).jabatan;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).jabatan = token.jabatan;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', 
  },
  session: {
    strategy: "jwt",
  }
};