"use client";

import React, { useEffect, useState } from "react";

export interface RoleMenuItem {
  id: string;
  label: string;
  shortLabel?: string; // Label singkat khusus bottom bar mobile (maks 10-12 karakter)
  group?: string;      // Pengelompokan menu di sidebar/drawer (misal: "Operasional", "Laporan")
  icon?: React.ReactNode;
  badge?: number | string;
  pinnedBottom?: boolean; // Tandai true untuk maks 4 menu utama di bottom bar mobile
}

interface ResponsiveRoleShellProps {
  roleName: string;
  userName?: string;
  userSubtitle?: string;
  menuItems: RoleMenuItem[];
  activeMenuId: string;
  onSelectMenu: (menuId: string) => void;
  onLogout?: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export default function ResponsiveRoleShell({
  roleName,
  userName,
  userSubtitle,
  menuItems,
  activeMenuId,
  onSelectMenu,
  onLogout,
  headerActions,
  children,
}: ResponsiveRoleShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Kunci scroll body saat drawer mobile terbuka & tutup dengan tombol Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  const activeMenu = menuItems.find((item) => item.id === activeMenuId);
  const pinnedMenus = menuItems.filter((item) => item.pinnedBottom).slice(0, 4);
  const bottomMenus =
    pinnedMenus.length > 0 ? pinnedMenus : menuItems.slice(0, 4);

  // Kelompokkan menu berdasarkan properti `group`
  const groupedMenus = menuItems.reduce<Record<string, RoleMenuItem[]>>(
    (acc, item) => {
      const groupKey = item.group || "Menu Utama";
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    },
    {}
  );

  const handleSelect = (id: string) => {
    onSelectMenu(id);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderMenuList = () => (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {Object.entries(groupedMenus).map(([groupTitle, items]) => (
        <div key={groupTitle}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {groupTitle}
          </p>
          <ul className="space-y-1">
            {items.map((item) => {
              const isActive = item.id === activeMenuId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {item.icon && (
                        <span className="shrink-0 text-current">{item.icon}</span>
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && Number(item.badge) > 0 && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-slate-50">
      {/* ================= DESKTOP SIDEBAR (>= 768px) ================= */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-[100dvh]">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="min-w-0">
            <span className="block text-base font-bold tracking-tight text-blue-700">
              myTLM
            </span>
            <span className="block truncate text-xs font-medium text-slate-500">
              {roleName}
            </span>
          </div>
        </div>

        {renderMenuList()}

        <div className="shrink-0 border-t border-slate-200 p-4">
          {userName && (
            <div className="mb-3 min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {userName}
              </p>
              {userSubtitle && (
                <p className="truncate text-xs text-slate-500">{userSubtitle}</p>
              )}
            </div>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Keluar Akun
            </button>
          )}
        </div>
      </aside>

      {/* ================= MOBILE SLIDE-OVER DRAWER (< 768px) ================= */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigasi Menu"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Panel Drawer */}
          <div className="relative z-10 flex h-[100dvh] w-[82vw] max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-700">myTLM</p>
                <p className="truncate text-xs text-slate-500">{roleName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {renderMenuList()}

            <div className="pb-safe shrink-0 border-t border-slate-200 bg-slate-50 p-4">
              {userName && (
                <div className="mb-3 min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {userName}
                  </p>
                  {userSubtitle && (
                    <p className="truncate text-xs text-slate-500">
                      {userSubtitle}
                    </p>
                  )}
                </div>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full rounded-xl bg-red-600 px-3 py-2.5 text-xs font-semibold text-white active:bg-red-700"
                >
                  Keluar Akun
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT COLUMN ================= */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Top Header (Mobile & Desktop) */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-xs sm:px-6 md:h-16">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka semua menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-200 md:hidden"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
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
              <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                {activeMenu?.label || roleName}
              </h1>
              <p className="truncate text-[11px] text-slate-500 md:hidden">
                {roleName}
              </p>
            </div>
          </div>

          {headerActions && (
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
            </div>
          )}
        </header>

        {/* Horizontal Pill Scroller untuk akses cepat antar menu di mobile */}
        <div className="no-scrollbar flex w-full gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          {menuItems.map((item) => {
            const isActive = item.id === activeMenuId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 active:bg-slate-200"
                }`}
              >
                <span>{item.shortLabel || item.label}</span>
                {item.badge !== undefined && Number(item.badge) > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-red-500 text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Area Konten Utama (pb-24 di mobile agar tidak tertutup bottom nav) */}
        <main className="min-w-0 flex-1 px-3 py-4 pb-24 sm:px-6 sm:py-6 md:pb-8">
          {children}
        </main>
      </div>

      {/* ================= MOBILE BOTTOM QUICK BAR (< 768px) ================= */}
      <nav
        aria-label="Navigasi Cepat Bawah"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-1 pt-1.5 backdrop-blur-xs md:hidden"
      >
        <div className="grid grid-cols-5 items-center gap-1">
          {bottomMenus.map((item) => {
            const isActive = item.id === activeMenuId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative flex flex-col items-center justify-center rounded-lg py-1 text-[11px] font-medium ${
                  isActive ? "text-blue-600" : "text-slate-500"
                }`}
              >
                <span className="mb-0.5 flex h-5 w-5 items-center justify-center">
                  {item.icon || (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isActive ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    />
                  )}
                </span>
                <span className="max-w-[64px] truncate">
                  {item.shortLabel || item.label}
                </span>
                {item.badge !== undefined && Number(item.badge) > 0 && (
                  <span className="absolute top-0.5 right-2 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}

          {/* Tombol ke-5: Buka Semua Menu */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center rounded-lg py-1 text-[11px] font-medium text-slate-600"
          >
            <span className="mb-0.5 flex h-5 w-5 items-center justify-center text-sm font-bold">
              ☰
            </span>
            <span>Semua</span>
          </button>
        </div>
      </nav>
    </div>
  );
}