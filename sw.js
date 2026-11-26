/* 오프라인 캐시: 앱 파일을 폰에 저장해 인터넷 없이 실행. 앱을 고치면 CACHE 버전을 올리세요. */
const CACHE = 'r3-v4';
const ASSETS = ['./', './index.html', './style.css', './manifest.webmanifest',
  './js/core.js', './js/ui.js', './js/record.js', './js/prod.js', './js/month.js', './js/settings.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 캐시 먼저 응답하고, 온라인이면 뒤에서 새 파일로 캐시 갱신 (다음 실행 때 반영)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
