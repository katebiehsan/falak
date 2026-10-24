// Gebet – Offline-Unterstützung
const V="miqat-v3";
const SHELL=["./","index.html","app.css","app.js","adhan.min.js","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=="miqat-data").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  // Quran-Texte und Schriften: aus dem Cache, im Hintergrund aktualisieren
  if(u.hostname==="api.alquran.cloud"||u.hostname==="cdn.jsdelivr.net"||u.hostname.endsWith("fonts.googleapis.com")||u.hostname.endsWith("fonts.gstatic.com")){
    e.respondWith(caches.open("miqat-data").then(async c=>{
      const hit=await c.match(e.request);
      const net=fetch(e.request).then(r=>{if(r.ok||r.type==="opaque")c.put(e.request,r.clone());return r}).catch(()=>hit);
      return hit||net;
    }));
    return;
  }
  // App selbst: erst Netz (damit Updates sofort ankommen), offline aus dem Cache
  if(u.origin===location.origin){
    e.respondWith(fetch(e.request).then(r=>{const cl=r.clone();caches.open(V).then(c=>c.put(e.request,cl));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
  }
});
