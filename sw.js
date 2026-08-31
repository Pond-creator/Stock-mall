// Service Worker ของ Stock Mall — มีไว้ 2 อย่าง:
// 1) ทำให้เบราว์เซอร์เสนอ "ติดตั้งแอป" ได้ (Android/Chrome/Edge ต้องมีไฟล์นี้)
// 2) โหลดไอคอน/ไฟล์ประกอบเร็วขึ้น
//
// ⚠️ สำคัญ: index.html ใช้แบบ "เอาจากเน็ตก่อนเสมอ" (network-first)
//    เพื่อให้ทุกครั้งที่อัปโค้ดใหม่ขึ้น GitHub ผู้ใช้ได้ของใหม่ทันที ไม่ค้างของเก่า
const CACHE = 'stockmall-v1';
const ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // ไม่ยุ่งกับ GAS / CDN (ต้องสดเสมอ)
  if (url.origin !== location.origin) return;

  // หน้าเว็บ (HTML) → เอาจากเน็ตก่อน ถ้าเน็ตหลุดค่อยใช้ตัวที่เก็บไว้
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // ไฟล์ประกอบ (ไอคอน/manifest) → ใช้ของที่เก็บไว้ก่อน เร็วกว่า
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
