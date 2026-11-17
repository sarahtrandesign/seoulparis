/* Offline support: the whole app is cached on first visit. Bump VERSION to ship an update. */
const VERSION = 'garden-1.3.0';
const SHELL = [
 "./",
 "./audio/bgm.mp3",
 "./css/app.css",
 "./data/fr.json",
 "./data/ko.json",
 "./data/meta.json",
 "./data/ui.json",
 "./fonts/bm-jua.ttf",
 "./icons/apple-touch-icon.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/icon-maskable-512.png",
 "./img/paper.png",
 "./index.html",
 "./js/app.js",
 "./js/art.js",
 "./js/data.js",
 "./js/motion.js",
 "./js/music.js",
 "./js/srs.js",
 "./js/store.js",
 "./manifest.webmanifest"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'garden-fonts').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('garden-fonts').then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
    return res;
  })));
});
