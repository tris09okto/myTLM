// app/components/RoleSidebarLayout.tsx
"use client";

import React, { useState, useEffect } from "react";

interface RoleSidebarLayoutProps {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  sidebarContent: React.ReactNode;
  children: React.ReactNode;
}

export default function RoleSidebarLayout({
  title,
  subtitle,
  headerRight,
  sidebarContent,
  children,
}: RoleSidebarLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSidebarOpen]);

  const handleSidebarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const clickable = target.closest("button, a");
    if (!clickable) return;

    // Jangan tutup drawer jika tombol adalah toggle accordion/dropdown
    if (
      clickable.getAttribute("data-no-close") === "true" ||
      clickable.hasAttribute("aria-expanded")
    ) {
      return;
    }

    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-slate-50">
      {/* SIDEBAR DESKTOP (>= 1024px) */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:w-72 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:bg-[#0f172a] lg:text-white">
        {sidebarContent}
      </aside>

      {/* DRAWER SIDEBAR MOBILE (< 1024px) */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />

          <aside
            onClick={handleSidebarClick}
            className="relative z-10 flex h-[100dvh] w-[82vw] max-w-[300px] flex-col overflow-y-auto overscroll-contain bg-[#0f172a] text-white shadow-2xl"
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-[#0f172a] px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Navigasi Menu
              </span>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="Tutup Menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 flex-col">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* AREA KONTEN UTAMA */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP HEADER MOBILE (< 1024px) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-sm lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Buka Menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f172a] text-white active:bg-slate-800"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-[11px] text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </header>

        {/* KONTEN DASHBOARD */}
        <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-6">
          <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}