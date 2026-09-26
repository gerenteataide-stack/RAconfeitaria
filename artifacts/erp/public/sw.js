importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

const CACHE_NAME = "ra-confeitaria-v5";
const APP_SHELL = ["/", "/cardapio", "/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];

firebase.initializeApp({
  apiKey: "AIzaSyCg7dC0dr68hWERsItQu_-FDFz7YRK8jcM",
  authDomain: "raconfeitaria01.firebaseapp.com",
  projectId: "raconfeitaria01",
  storageBucket: "raconfeitaria01.firebasestorage.app",
  messagingSenderId: "709096841923",
  appId: "1:709096841923:web:7566faabf6d98cf9f53876",
  measurementId: "G-8ZWPZ3YRTX",
});

const messaging = firebase.messaging();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "Novo pedido recebido";
  return self.registration.showNotification(title, {
    body: payload.data?.body || "Um novo pedido está aguardando atendimento.",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: payload.data?.tag || `pedido-${payload.data?.orderId || "novo"}`,
    data: { url: payload.data?.url || "/orders" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/orders", self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(request).then((cached) => cached || caches.match("/")),
    ),
  );
});
