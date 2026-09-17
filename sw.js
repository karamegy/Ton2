const CACHE_NAME = 'giti-invoices-v30'; // تم رفع الإصدار لإجبار التحديث وحذف الكاش التالف

// تخزين الملفات المحلية الأساسية فقط (تجنبنا الـ CDNs لمنع فشل التثبيت)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.png'
];

// 1. تثبيت الـ Service Worker بأمان تام دون انهيار
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. تفعيل الملف وتنظيف الكاش القديم فوراً
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. اعتراض الطلبات وتوفير الأداء أوفلاين
self.addEventListener('fetch', (event) => {
  // استثناء اتصالات السحابة والإعلانات لضمان عدم التعليق
  if (
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('identitytoolkit.googleapis.com') ||
    event.request.url.includes('securetoken.googleapis.com') ||
    event.request.url.includes('pagead2.googlesyndication.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
