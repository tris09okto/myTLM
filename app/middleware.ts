import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    // CETAK LOG INI KE TERMINAL (Bukan di browser)
    console.log(`[Middleware] Akses Path: ${path} | Role terdeteksi: '${role}'`);

    // Proteksi rute Super Admin
    if (path.startsWith("/super-admin") && role !== "super_admin") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Proteksi rute Admin (Super Admin biasanya juga boleh akses ini, sesuaikan logika Anda)
    if (path.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Proteksi rute Pegawai
    if (path.startsWith("/pegawai") && role !== "pegawai") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Proteksi rute Admin Keuangan
    if (path.startsWith("/keuangan") && role !== "keuangan") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Proteksi rute leader
    if (path.startsWith("/leader") && role !== "leader") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Proteksi rute guest
    if (path.startsWith("/guest") && role !== "guest") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Proteksi rute supervisor
    if (path.startsWith("/supervisor") && role !== "supervisor") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  },
  {
    callbacks: {
      // Pastikan token ada agar middleware dijalankan
      authorized: ({ token }) => !!token,
    },
  }
);

// Tentukan rute mana saja yang ingin diproteksi oleh middleware
export const config = {
  matcher: ["/super-admin/:path*", "/admin/:path*", "/keuangan/:path*", "/pegawai/:path*", "/leader/:path*", "/guest/:path*", "/supervisor/:path*"],
};