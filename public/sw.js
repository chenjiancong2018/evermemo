/**
 * Evermemo Service Worker
 *
 * 目标（PRD：PWA「添加到主屏幕/离线」的轻量实现）：
 * - 静态资源（/_next/static、图标、manifest）缓存优先 → 二次打开更快、离线可加载外壳
 * - 页面导航网络优先，离线时回退到预缓存的 /offline 页面
 * - 不缓存 API 响应（记忆数据永远以服务器/数据库为准，避免共享设备上的陈旧数据）
 *
 * 版本号变更会自动清理旧缓存。
 */

const VERSION = 'evermemo-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

const PRECACHE = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 不缓存 API 与认证相关响应
  if (url.pathname.startsWith('/api/')) return;

  // 静态资源：cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // 页面导航：network-first，离线回退 /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match('/offline').then((hit) => hit || caches.match(request)))
        .then((res) => res || new Response('offline', { status: 503, statusText: 'Offline' }))
    );
  }
});
