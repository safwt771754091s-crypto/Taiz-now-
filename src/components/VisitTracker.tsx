"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires a page-view beacon on every route change so the owner's visit ledger
 * records who is on the platform. Skips staff-only screens and admin APIs.
 */
const SKIP = ["/login", "/api/", "/dashboard", "/security", "/admin", "/agents", "/platform"];

export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || SKIP.some((p) => pathname.startsWith(p))) return;
    const body = JSON.stringify({ path: pathname });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      /* never block the page */
    }
  }, [pathname]);

  return null;
}
