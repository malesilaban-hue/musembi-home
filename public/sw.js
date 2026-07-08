// Minimal service worker for PWA install eligibility.
// A fetch handler is required for Chrome/Android to fire `beforeinstallprompt`.
// This SW does not cache — it just passes requests through to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  // Network passthrough. Never intercept OAuth callbacks or Supabase auth.
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/~oauth")) return;
  event.respondWith(fetch(event.request).catch(() => new Response("", { status: 504 })));
});
