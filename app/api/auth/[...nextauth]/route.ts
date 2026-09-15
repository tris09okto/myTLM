import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { pool } from "@/lib/db";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const [rows]: any = await pool.query(
          "SELECT * FROM users WHERE username = ?",
          [credentials.username]
        );

        const user = rows[0];

        if (user && await bcrypt.compare(credentials.password, user.password)) {
          // Kembalikan data user beserta role dan jabatan ke dalam session
          return {
            id: user.id.toString(),
            name: user.username,
            role: user.role,
            jabatan: user.jabatan,
          };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.jabatan = user.jabatan;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.role = token.role;
        session.user.jabatan = token.jabatan;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Arahkan ke custom halaman login Anda
  },
  session: {
    strategy: "jwt",
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };