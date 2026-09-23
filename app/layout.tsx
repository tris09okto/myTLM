import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "my TLM",
  description: "Aplikasi Manajemen my TLM",
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
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}