"use client";

import { useEffect } from "react";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    async function cleanupLegacyOfflineShell() {
      if (!("serviceWorker" in navigator)) return;

      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    }

    cleanupLegacyOfflineShell().catch(() => {
      // Best-effort cleanup only. The app should still load if browser storage APIs fail.
    });
  }, []);

  return null;
}
