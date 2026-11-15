"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export const TAB_SESSION_KEY = "mytlm_active_tab_session";

export default function SessionAutoLogoutGuard() {
  const { status } = useSession();
  const pathname = usePathname();
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || isLoggingOutRef.current) return;

    const hasActiveTabSession =
      sessionStorage.getItem(TAB_SESSION_KEY) === "1";

    // Jika berada di /login dengan sesi lama (bukan proses submit login yang baru berhasil)
    if (pathname === "/login") {
      if (!hasActiveTabSession) {
        isLoggingOutRef.current = true;
        signOut({ redirect: false }).finally(() => {
          isLoggingOutRef.current = false;
        });
      }
      return;
    }

    // Jika membuka rute dashboard langsung di tab/browser baru tanpa melewati login
    if (pathname !== "/" && !hasActiveTabSession) {
      isLoggingOutRef.current = true;
      sessionStorage.removeItem(TAB_SESSION_KEY);
      signOut({
        redirect: true,
        callbackUrl: "/login",
      });
    }
  }, [status, pathname]);

  return null;
}