// Falak – Offline-Unterstützung
const V="falak-v14";
const SHELL=["./","index.html","app.css","app.js","adhan.min.js","magvar.min.js","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png","favicon-32.png","favicon-64.png","fonts/amiri-arabic.woff2","fonts/amiri-quran-arabic.woff2"];
// Beim Installieren am HTTP-Cache vorbei laden (cache:"reload"), sonst kann GitHub Pages bis zu 10 Min. alte Dateien liefern
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.map(p=>new Request(p,{cache:"reload"})))).then(()=>self.skipWaiting()))});
// Alte App-Versionen löschen; aus dem Datenspeicher die früher geladenen Google-Schriften entfernen (jetzt lokal)
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=="falak-data").map(k=>caches.delete(k))))
  .then(()=>caches.open("falak-data")).then(c=>c.keys().then(rs=>Promise.all(rs.filter(r=>/fonts\.(googleapis|gstatic)\.com/.test(r.url)).map(r=>c.delete(r)))))
  .then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET")return;
  // Quran-Texte und Hadithe: aus dem Cache, im Hintergrund aktualisieren
  if(u.hostname==="api.alquran.cloud"||u.hostname==="cdn.jsdelivr.net"||u.hostname==="raw.githubusercontent.com"){
    e.respondWith(caches.open("falak-data").then(async c=>{
      const hit=await c.match(e.request);
      const net=fetch(e.request).then(r=>{if(r.ok||r.type==="opaque")c.put(e.request,r.clone());return r}).catch(()=>hit||Response.error());
      return hit||net;
    }));
    return;
  }
  // Seite selbst: erst Netz (am HTTP-Cache vorbei, damit Updates sofort ankommen), aber höchstens 2 Sekunden warten.
  // Bei schlechtem Empfang startet Falak dann aus dem Cache; die Netz-Antwort aktualisiert den Cache trotzdem für den nächsten Start.
  // Skripte, Styles, Schriften, Icons: sofort aus dem Cache (jede neue Version bringt per Cache-Version ihren eigenen Satz mit)
  if(u.origin===location.origin&&e.request.mode!=="navigate"){
    e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
      const net=fetch(e.request,{cache:"no-cache"}).then(r=>{if(r.ok){const cl=r.clone();caches.open(V).then(c=>c.put(e.request,cl))}return r});
      if(hit){e.waitUntil(net.catch(()=>{}));return hit}
      return net;
    }));
    return;
  }
  if(u.origin===location.origin){
    e.respondWith((async()=>{
      const net=fetch(e.request,{cache:"no-cache"}).then(r=>{if(r.ok){const cl=r.clone();caches.open(V).then(c=>c.put(e.request,cl))}return r});
      e.waitUntil(net.catch(()=>{}));
      const cached=caches.match(e.request,{ignoreSearch:true});
      const slow=new Promise(res=>setTimeout(()=>res("slow"),2000));
      try{
        const first=await Promise.race([net,slow]);
        if(first!=="slow")return first;
        return (await cached)||await net;
      }catch(err){return (await cached)||Response.error()}
    })());
  }
});
