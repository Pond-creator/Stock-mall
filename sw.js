// Service Worker ของ Stock Mall — มีไว้ 3 อย่าง:
// 1) ทำให้เบราว์เซอร์เสนอ "ติดตั้งแอป" ได้ (Android/Chrome/Edge ต้องมีไฟล์นี้)
// 2) โหลดไอคอน/ไฟล์ประกอบเร็วขึ้น
// 3) เก็บไลบรารีกล้องสแกน QR ไว้ในเครื่อง → เน็ตหลุดแล้วเปิดแอปใหม่ ยังสแกนได้
//
// ⚠️ สำคัญ: index.html ใช้แบบ "เอาจากเน็ตก่อนเสมอ" (network-first)
//    เพื่อให้ทุกครั้งที่อัปโค้ดใหม่ขึ้น GitHub ผู้ใช้ได้ของใหม่ทันที ไม่ค้างของเก่า
const CACHE = 'stockmall-v2';
const ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// ไลบรารีจากเน็ตที่ "ต้องมี" ตอนใช้งานหน้างาน — เก็บไว้ในเครื่องด้วย
// (ปกติ SW ตัวนี้ไม่ยุ่งกับของนอกบ้าน แต่ 2 ตัวนี้ยกเว้นให้ เพราะถ้าโหลดไม่ได้ = สแกน QR ไม่ได้)
// ⚠️ ถ้าเปลี่ยน URL/เวอร์ชันใน index.html ต้องมาแก้ที่นี่ด้วย แล้วเปลี่ยนเลขท้าย CACHE
const CDN = [
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4'
];
const isCdn = u => CDN.some(c => u === c || u.indexOf(c) === 0);

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // เก็บทีละไฟล์ ไม่ใช้ addAll — ตัวใดตัวหนึ่งโหลดไม่ได้ ตัวที่เหลือต้องยังถูกเก็บ
      Promise.all(ASSETS.concat(CDN).map(u => c.add(u).catch(() => {})))
    ).catch(() => {})
  );
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

  if (url.origin !== location.origin) {
    // ของนอกบ้าน: ยุ่งเฉพาะไลบรารีที่จำเป็น — ใช้ของในเครื่องก่อน ไม่มีค่อยโหลดจากเน็ตแล้วเก็บไว้
    // ที่เหลือ (รวม GAS) ปล่อยผ่าน ต้องสดเสมอ
    if (!isCdn(url.href)) return;
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

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
