import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const authMiddleware = withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    console.log(`[Middleware] Akses Path: ${path} | Role terdeteksi: '${role}'`);

    if (path.startsWith("/super-admin") && role !== "super_admin") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/pegawai") && role !== "pegawai") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/keuangan") && role !== "keuangan") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/leader") && role !== "leader") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/guest") && role !== "guest") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/supervisor") && role !== "supervisor") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    if (path.startsWith("/mitra") && role !== "mitra") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const path = req.nextUrl.pathname;

  // Saat mengakses root mytlmapp.com ("/")
  if (path === "/") {
    const justLoggedIn = req.cookies.get("mytlm_just_logged_in")?.value === "1";

    // Jika baru saja login dari /login, biarkan app/page.tsx mengarahkan sesuai role
    if (justLoggedIn) {
      const response = NextResponse.next();
      response.cookies.set("mytlm_just_logged_in", "", {
        maxAge: 0,
        expires: new Date(0),
        path: "/",
      });
      return response;
    }

    // Jika akses baru ke mytlmapp.com dengan cookie sesi lama, hapus cookie & paksa ke /login
    const loginUrl = new URL("/login", req.url);
    const response = NextResponse.redirect(loginUrl);
    const isHttps = req.nextUrl.protocol === "https:";

    for (const cookie of req.cookies.getAll()) {
      if (
        cookie.name.includes("next-auth.session-token") ||
        cookie.name.includes("next-auth.callback-url")
      ) {
        response.cookies.set(cookie.name, "", {
          maxAge: 0,
          expires: new Date(0),
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: cookie.name.startsWith("__Secure-") || isHttps,
        });
      }
    }

    return response;
  }

  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: [
    "/",
    "/super-admin/:path*",
    "/admin/:path*",
    "/keuangan/:path*",
    "/pegawai/:path*",
    "/leader/:path*",
    "/guest/:path*",
    "/supervisor/:path*",
    "/mitra/:path*",
  ],
};