// Kargo service worker – rýchle načítanie + push notifikácie
const VERSION = 'kargo-v13'
const SHELL = ['./', 'index.html', 'app.js', 'geo.js', 'manifest.json', 'widget-template.js', 'icon-192.png', 'apple-touch-icon.png']
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || /supabase\.co|nominatim|17track/.test(u.host)) return
  const own = u.origin === location.origin
  const page = own && (e.request.mode === 'navigate' || /\.(js|html|json)$/.test(u.pathname))
  if (page) { // najprv sieť, aby bola vždy nová verzia
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); return r }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))))
    return
  }
  if (/unpkg\.com|jsdelivr|openfreemap|alicdn|icons\//.test(u.href)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((n) => { if (n.ok || n.type === 'opaque') { const c = n.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)) } return n })))
  }
})
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json() } catch (_) { d = { title: 'Kargo', body: e.data?.text() ?? '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Kargo', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './' } }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => { for (const w of ws) if ('focus' in w) { w.navigate(url); return w.focus() } return clients.openWindow(url) }))
})
