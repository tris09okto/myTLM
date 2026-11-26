// app/SessionAutoLogoutGuard.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

// Di-export agar tetap terbaca oleh app/login/page.tsx
export const TAB_SESSION_KEY = "mytlm_tab_session";

const SESSION_INIT_KEY = "mytlm_session_initialized";
const TAB_CLOSED_KEY = "mytlm_tab_closed";
const HEARTBEAT_KEY = "mytlm_tab_heartbeat";
const LAST_ACTIVITY_KEY = "mytlm_last_activity";

// Selaraskan dengan SESSION_MAX_AGE_SECONDS di lib/auth.ts (30 menit)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const HEARTBEAT_STALE_MS = 12 * 1000;

export default function SessionAutoLogoutGuard() {
  const { status } = useSession();
  const pathname = usePathname();
  const isLoggingOutRef = useRef(false);

  const clearSessionMarkers = useCallback(() => {
    try {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      localStorage.removeItem(SESSION_INIT_KEY);
      localStorage.removeItem(TAB_CLOSED_KEY);
      localStorage.removeItem(HEARTBEAT_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {}
  }, []);

  const forceLogout = useCallback(
    async (reason: "browser_closed" | "idle_timeout" | "sync") => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      clearSessionMarkers();

      if (pathname !== "/login") {
        await signOut({
          callbackUrl: `/login?reason=${reason}`,
          redirect: true,
        });
      }
    },
    [pathname, clearSessionMarkers]
  );

  // 1. Evaluasi status sesi saat halaman pertama kali dibuka atau di-reload
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Jangan hapus TAB_SESSION_KEY jika user sedang berada di /login dan baru saja men-set marker
      if (pathname !== "/login") {
        clearSessionMarkers();
      } else {
        try {
          localStorage.removeItem(SESSION_INIT_KEY);
          localStorage.removeItem(TAB_CLOSED_KEY);
          localStorage.removeItem(HEARTBEAT_KEY);
          localStorage.removeItem(LAST_ACTIVITY_KEY);
        } catch {}
      }
      isLoggingOutRef.current = false;
      return;
    }

    if (status === "authenticated") {
      try {
        // Cek truthy (mendukung "1", "true", "active", dll. dari app/login/page.tsx)
        const isSameTabSession = Boolean(
          sessionStorage.getItem(TAB_SESSION_KEY)
        );
        const wasSessionInitialized =
          localStorage.getItem(SESSION_INIT_KEY) === "1";
        const wasTabClosed = localStorage.getItem(TAB_CLOSED_KEY) === "1";
        const lastHeartbeat = Number(localStorage.getItem(HEARTBEAT_KEY) || 0);
        const isHeartbeatStale =
          !lastHeartbeat || Date.now() - lastHeartbeat > HEARTBEAT_STALE_MS;

        // Jika bukan tab yang sama dan sesi lama sebelumnya sudah ditutup/tidak aktif -> paksa login ulang
        if (
          !isSameTabSession &&
          wasSessionInitialized &&
          (wasTabClosed || isHeartbeatStale)
        ) {
          forceLogout("browser_closed");
          return;
        }

        // Cek batas waktu idle
        const lastActivityRaw = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActivityRaw) {
          const elapsed = Date.now() - Number(lastActivityRaw);
          if (!Number.isNaN(elapsed) && elapsed > IDLE_TIMEOUT_MS) {
            forceLogout("idle_timeout");
            return;
          }
        }

        // Pertahankan marker tab aktif
        const now = String(Date.now());
        if (!sessionStorage.getItem(TAB_SESSION_KEY)) {
          sessionStorage.setItem(TAB_SESSION_KEY, "1");
        }
        localStorage.setItem(SESSION_INIT_KEY, "1");
        localStorage.setItem(TAB_CLOSED_KEY, "0");
        localStorage.setItem(HEARTBEAT_KEY, now);
        localStorage.setItem(LAST_ACTIVITY_KEY, now);
      } catch {}
    }
  }, [status, pathname, forceLogout, clearSessionMarkers]);

  // 2. Heartbeat tab aktif, deteksi tutup tab (pagehide), & cek idle mobile
  useEffect(() => {
    if (status !== "authenticated") return;

    const updateActivity = () => {
      if (isLoggingOutRef.current) return;
      try {
        const now = String(Date.now());
        localStorage.setItem(LAST_ACTIVITY_KEY, now);
        localStorage.setItem(HEARTBEAT_KEY, now);
      } catch {}
    };

    const checkIdleExpiration = () => {
      if (isLoggingOutRef.current) return;
      try {
        const lastActivityRaw = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (!lastActivityRaw) return;

        const elapsed = Date.now() - Number(lastActivityRaw);
        if (!Number.isNaN(elapsed) && elapsed > IDLE_TIMEOUT_MS) {
          forceLogout("idle_timeout");
        }
      } catch {}
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        try {
          localStorage.setItem(TAB_CLOSED_KEY, "1");
        } catch {}
      }
    };

    const handleVisibilityOrResume = () => {
      if (document.visibilityState === "visible") {
        checkIdleExpiration();
        try {
          localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
        } catch {}
      }
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key === SESSION_INIT_KEY && event.newValue === null) {
        forceLogout("sync");
      }
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    activityEvents.forEach((evt) =>
      window.addEventListener(evt, updateActivity, { passive: true })
    );
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityOrResume);
    window.addEventListener("focus", checkIdleExpiration);
    window.addEventListener("pageshow", checkIdleExpiration);
    window.addEventListener("storage", handleStorageSync);

    const heartbeatInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        try {
          localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
        } catch {}
      }
      checkIdleExpiration();
    }, 4000);

    return () => {
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, updateActivity)
      );
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityOrResume
      );
      window.removeEventListener("focus", checkIdleExpiration);
      window.removeEventListener("pageshow", checkIdleExpiration);
      window.removeEventListener("storage", handleStorageSync);
      window.clearInterval(heartbeatInterval);
    };
  }, [status, forceLogout]);

  return null;
}