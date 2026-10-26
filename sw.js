// Gebet – Offline-Unterstützung
const V="falak-v1";
const SHELL=["./","index.html","app.css","app.js","adhan.min.js","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png","favicon-32.png","favicon-64.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=="falak-data").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  // Quran-Texte und Schriften: aus dem Cache, im Hintergrund aktualisieren
  if(u.hostname==="api.alquran.cloud"||u.hostname==="cdn.jsdelivr.net"||u.hostname.endsWith("fonts.googleapis.com")||u.hostname.endsWith("fonts.gstatic.com")){
    e.respondWith(caches.open("falak-data").then(async c=>{
      const hit=await c.match(e.request);
      const net=fetch(e.request).then(r=>{if(r.ok||r.type==="opaque")c.put(e.request,r.clone());return r}).catch(()=>hit);
      return hit||net;
    }));
    return;
  }
  // App selbst: erst Netz, am HTTP-Cache vorbei (GitHub Pages cacht 10 Min.), damit Updates sofort ankommen, offline aus dem Cache
  if(u.origin===location.origin){
    e.respondWith(fetch(e.request,{cache:"no-cache"}).then(r=>{const cl=r.clone();caches.open(V).then(c=>c.put(e.request,cl));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
  }
});
