const CACHE_NAME = "lucky-list-shell-v3";
const APP_SHELL = ["/", "/app", "/app/focus", "/app/tasks", "/app/board", "/app/calendar", "/app/archive", "/app/settings", "/login", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes("supabase.co") || event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/app"))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "LUCKY_LIST_SHOW_REMINDER") return;
  event.waitUntil(
    self.registration.showNotification(event.data.title || "Lucky List reminder", {
      body: event.data.body || "Task reminder",
      tag: event.data.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: "/app/focus" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const appClient = clients.find((client) => "focus" in client);
      if (appClient) return appClient.focus();
      return self.clients.openWindow(event.notification.data?.url || "/app");
    }),
  );
});
