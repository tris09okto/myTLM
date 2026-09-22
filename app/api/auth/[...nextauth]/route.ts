import NextAuth, { NextAuthOptions } from "next-auth";
import { authOptions } from "@/lib/auth"; // Import konfigurasi


const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };