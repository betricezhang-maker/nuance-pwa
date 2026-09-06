const C="nuance-v2-1";const A=["/","/index.html","/manifest.webmanifest","/icons/icon-192.png","/icons/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener("fetch",e=>{if(e.request.url.includes("/api/"))return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
