"use client";
import { useEffect } from "react";

/** Service worker only in production builds (dev chunks are not content-hashed) — or when forced with ?sw=1. */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const force = location.search.includes("sw=1");
    if (process.env.NODE_ENV !== "production" && !force) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("message", (e) => {
      if ((e.data as { type?: string })?.type === "flush-outbox") window.dispatchEvent(new Event("online"));
    });
  }, []);
  return null;
}
