self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());
self.addEventListener("fetch", (event) => {
  // همیشه از شبکه بخوان، هیچ‌وقت از cache نده
  event.respondWith(fetch(event.request));
});
