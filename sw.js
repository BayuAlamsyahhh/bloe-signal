self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open('bloe-cache-v3').then(c=>c.addAll(['./','./index.html','./app.js','./manifest.json'])))});
self.addEventListener('activate',e=>{self.clients.claim()});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone();caches.open('bloe-cache-v3').then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match('./index.html'))))});
