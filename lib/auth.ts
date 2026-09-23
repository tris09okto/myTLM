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
        const parsedCredentials = parseCredentials(credentials);

        if (!parsedCredentials) return null;

        const user = await authenticateUser(parsedCredentials);

        return user
          ? {
              id: String(user.id),
              name: user.username,
              role: user.role,
              jabatan: user.jabatan,
            }
          : null;
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
