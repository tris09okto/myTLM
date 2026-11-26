import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import SessionAutoLogoutGuard from "./SessionAutoLogoutGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "my TLM",
  description: "Aplikasi Manajemen my TLM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

// Patch aman untuk mencegah crash-loop dari environment Hostinger
if (typeof process !== 'undefined' && typeof process.emit === 'function') {
  const originalEmit = process.emit;
  // @ts-ignore
  process.emit = function (name: string, data: any, ...args: any[]) {
    if (name === 'uncaughtException' && data?.message?.includes('Server is not running')) {
      return false;
    }
    // @ts-ignore
    return originalEmit.apply(process, [name, data, ...args]);
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-[100dvh] w-full overflow-x-clip bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <SessionAutoLogoutGuard />
          {children}
        </Providers>
      </body>
    </html>
  );
}