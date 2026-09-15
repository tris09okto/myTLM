import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
      jabatan: string;
    }
  }
  interface User {
    role: string;
    jabatan: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    jabatan: string;
  }
}