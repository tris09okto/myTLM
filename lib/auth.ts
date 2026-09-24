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
          console.log("=== DEBUG RAW CREDENTIALS ===");
          console.log(credentials);
          console.log("=============================");

          // 2. Gunakan pengecekan tipe data eksplisit, bukan sekadar truthy/falsy
          if (typeof credentials?.username !== 'string' || typeof credentials?.password !== 'string') {
            console.error("DEBUG AUTH: Kredensial tidak valid atau tidak terbaca dari body request.");
            return null;
          }

          const payload = {
            username: credentials.username.trim(),
            password: credentials.password
          };

          const parsedCredentials = parseCredentials(payload);
          
          if (!parsedCredentials) {
            console.error("DEBUG AUTH: Kredensial gagal diparsing oleh parseCredentials.");
            return null;
          }

          const user = await authenticateUser(parsedCredentials);
          
          if (!user) {
            console.error("DEBUG AUTH: User tidak ditemukan atau password salah.");
            return null;
          }

          return {
            id: String(user.id),
            name: user.username,
            role: user.role,
            jabatan: user.jabatan,
          };

        } catch (error) {
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