(function(){
"use strict";
const $=id=>document.getElementById(id);
const R=Math.PI/180;

/* ================= Speicher ================= */
const store={
  get(k,d){try{const v=localStorage.getItem("miqat."+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem("miqat."+k,JSON.stringify(v))}catch(e){}}
};
let loc=store.get("loc",{name:"Bremen",lat:53.07,lon:8.85});
let prefs=Object.assign({ar:true,tr:false,de:true,en:false,size:28},store.get("prefs",{}));
let marks=store.get("marks",{});          // "2:255" -> {c:"yellow", t:"Snippet"}
let resume=store.get("resume",null);       // zuletzt gelesen {s,a}
let bookmark=store.get("bookmark",null);   // Lesezeichen {s,a}

/* ================= Toast ================= */
let toastT;
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),1600)}

/* ================= Tabs ================= */
let view="times";const scrollMem={};
function setView(v){
  if(v===view)return;
  scrollMem[view]=window.scrollY;
  view=v;
  ["times","qibla","quran"].forEach(n=>{$("v-"+n).hidden=n!==v});
  document.querySelectorAll(".tabbar button").forEach(b=>b.setAttribute("aria-selected",b.dataset.v===v));
  window.scrollTo(0,scrollMem[v]||0);
  if(v==="qibla")initQibla();
  if(v==="quran")initQuran();
  if(v==="times")renderTimes();
}
document.querySelectorAll(".tabbar button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.v)));

/* ================= Sheets ================= */
let openSheetEl=null;
function openSheet(id){closeSheet(true);openSheetEl=$(id);$("scrim").classList.add("open");openSheetEl.classList.add("open")}
function closeSheet(instant){if(!openSheetEl)return;openSheetEl.classList.remove("open");if(!instant)$("scrim").classList.remove("open");openSheetEl=null;if(instant)$("scrim").classList.remove("open")}
$("scrim").addEventListener("click",()=>closeSheet());
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet()});
document.querySelectorAll(".sheet").forEach(s=>{
  let y0=null,t0=0,dy=0;
  s.addEventListener("touchstart",e=>{
    const list=e.target.closest(".sheetlist");if(list&&list.scrollTop>0)return;
    y0=e.touches[0].clientY;t0=Date.now();dy=0;s.style.transition="none"},{passive:true});
  s.addEventListener("touchmove",e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy>0)s.style.transform=`translateY(${dy}px)`},{passive:true});
  s.addEventListener("touchend",()=>{if(y0==null)return;s.style.transition="";s.style.transform="";
    if(dy>100||dy/(Date.now()-t0)>0.5)closeSheet();y0=null});
});

/* ================= Gebetszeiten ================= */
const PRAYERS=[["fajr","Fajr"],["sunrise","Shuruq"],["dhuhr","Dhuhr"],["asr","Asr"],["maghrib","Maghrib"],["isha","Isha"]];
const LABEL=Object.fromEntries(PRAYERS);
let dayOffset=0;
function params(){const p=adhan.CalculationMethod.MuslimWorldLeague();p.madhab=adhan.Madhab.Shafi;p.highLatitudeRule=adhan.HighLatitudeRule.SeventhOfTheNight;return p}
function dayStart(o){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+o);return d}
function times(day){return new adhan.PrayerTimes(new adhan.Coordinates(loc.lat,loc.lon),day,params())}
const fT=d=>d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
function fLeft(ms){const m=Math.max(0,Math.ceil(ms/6e4)),h=Math.floor(m/60),r=m%60;return h?`${h} Std. ${r} Min.`:`${r} Min.`}
function hijri(d){try{return new Intl.DateTimeFormat("de-DE-u-ca-islamic-umalqura",{day:"numeric",month:"long",year:"numeric"}).format(d)}catch(e){return""}}
function state(now){
  const t=times(dayStart(0));let cur=null,next=null;
  for(let i=PRAYERS.length-1;i>=0;i--){const k=PRAYERS[i][0];if(now>=t[k]){cur={k,t:t[k],today:true};
    next=i<PRAYERS.length-1?{k:PRAYERS[i+1][0],t:t[PRAYERS[i+1][0]]}:{k:"fajr",t:times(dayStart(1)).fajr};break}}
  if(!cur){cur={k:"isha",t:times(dayStart(-1)).isha,today:false};next={k:"fajr",t:t.fajr}}
  return{cur,next};
}
function renderTimes(){
  const now=new Date(),day=dayStart(dayOffset),t=times(day),live=dayOffset===0,{cur,next}=state(now);
  $("locName").textContent=loc.name;
  $("hijri").textContent=hijri(live?now:day);
  if(live){
    $("heroLabel").textContent="Jetzt";
    $("curName").textContent=LABEL[cur.k];
    $("nextLine").innerHTML=`${LABEL[next.k]} in <b>${fLeft(next.t-now)}</b>`;
    $("progress").hidden=false;
    const f=(now-cur.t)/(next.t-cur.t);
    $("progressFill").style.transform=`scaleX(${Math.min(1,Math.max(.015,f)).toFixed(4)})`;
  }else{
    $("heroLabel").textContent=dayOffset>0?"Vorschau":"Rückblick";
    $("curName").textContent=day.toLocaleDateString("de-DE",{weekday:"long"});
    $("nextLine").textContent=day.toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"});
    $("progress").hidden=true;
  }
  const fri=day.getDay()===5;
  $("times").innerHTML=PRAYERS.map(([k,n])=>{
    let c="row";
    if(live){if(cur.today&&k===cur.k)c+=" cur";else if(t[k]<now&&cur.today)c+=" past"}
    return `<div class="${c}"><span class="n">${k==="dhuhr"&&fri?"Jumu'a":n}</span><span class="t">${fT(t[k])}</span></div>`;
  }).join("");
  const dl=$("dayLabel");
  dl.textContent=live?"Heute":day.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"});
  dl.classList.toggle("off",!live);
}
$("prevDay").addEventListener("click",()=>{dayOffset--;renderTimes()});
$("nextDay").addEventListener("click",()=>{dayOffset++;renderTimes()});
$("dayLabel").addEventListener("click",()=>{dayOffset=0;renderTimes()});

/* ================= Ort ================= */
const CITIES=[["Bremen",53.07,8.85],["Bremerhaven",53.5396,8.5809],["Oldenburg",53.1435,8.2146],["Hamburg",53.5511,9.9937],
 ["Hannover",52.3759,9.7320],["Osnabrück",52.2799,8.0472],["Berlin",52.52,13.405],["Kiel",54.3233,10.1228],["Lübeck",53.8655,10.6866],
 ["Bielefeld",52.0302,8.5325],["Münster",51.9607,7.6261],["Dortmund",51.5136,7.4653],["Essen",51.4556,7.0116],["Duisburg",51.4344,6.7623],
 ["Düsseldorf",51.2277,6.7735],["Köln",50.9375,6.9603],["Bonn",50.7374,7.0982],["Frankfurt am Main",50.1109,8.6821],["Mannheim",49.4875,8.466],
 ["Stuttgart",48.7758,9.1829],["Nürnberg",49.4521,11.0767],["München",48.1351,11.582],["Leipzig",51.3397,12.3731],["Dresden",51.0504,13.7373]];
function buildCities(){
  $("cities").innerHTML=CITIES.map((c,i)=>{const sel=Math.abs(c[1]-loc.lat)<1e-4&&Math.abs(c[2]-loc.lon)<1e-4;
    return `<button class="city${sel?" sel":""}" data-i="${i}"><span>${c[0]}</span><small>${c[1].toFixed(2)}, ${c[2].toFixed(2)}</small></button>`}).join("");
}
$("cities").addEventListener("click",e=>{const b=e.target.closest(".city");if(!b)return;const c=CITIES[+b.dataset.i];setLoc({name:c[0],lat:c[1],lon:c[2]})});
function setLoc(l){loc=l;store.set("loc",l);closeSheet();renderTimes();if(qInit)updateQiblaTarget();toast(`Ort: ${l.name}`)}
$("locBtn").addEventListener("click",()=>{buildCities();const s=$("gpsStatus");s.classList.remove("err");
  s.textContent="Der Standort wird nur jetzt einmal abgefragt und danach nicht automatisch geändert.";openSheet("locSheet")});
$("gpsBtn").addEventListener("click",()=>{
  const s=$("gpsStatus");s.classList.remove("err");
  if(!navigator.geolocation){s.textContent="Dieses Gerät unterstützt keine Standortabfrage.";s.classList.add("err");return}
  s.textContent="Standort wird ermittelt …";
  navigator.geolocation.getCurrentPosition(async p=>{
    const lat=+p.coords.latitude.toFixed(4),lon=+p.coords.longitude.toFixed(4);let name="Aktueller Standort";
    try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=de&lat=${lat}&lon=${lon}`);
      const j=await r.json();const a=j.address||{};name=a.city||a.town||a.village||a.municipality||a.suburb||name}catch(e){}
    setLoc({name,lat,lon});
  },err=>{
    s.classList.add("err");
    s.textContent=err.code===1?"Standortzugriff abgelehnt. Erlaube ihn in den iPhone-Einstellungen unter Datenschutz › Ortungsdienste › Safari-Websites.":"Standort nicht gefunden. Versuch es draußen noch einmal oder wähle eine Stadt.";
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
});

/* ================= Qibla ================= */
const MECCA={lat:21.4225,lon:39.8262};
let qInit=false,qTarget=0,listening=false,lastEvt=0,sx=null,sy=null,raf=0,wasAligned=false;
function compassName(d){return["Nord","Nordost","Ost","Südost","Süd","Südwest","West","Nordwest"][Math.round(d/45)%8]}
function distKm(){const a=loc.lat*R,b=MECCA.lat*R,dl=(MECCA.lon-loc.lon)*R;return 6371*Math.acos(Math.min(1,Math.sin(a)*Math.sin(b)+Math.cos(a)*Math.cos(b)*Math.cos(dl)))}
function buildRose(){
  const c=160;let s=`<circle class="ring" cx="${c}" cy="${c}" r="150"/>`;
  for(let d=0;d<360;d+=5){const major=d%30===0,a=(d-90)*R,r1=major?132:139,r2=146;
    s+=`<line class="tick${major?" major":""}" stroke-width="${major?1.6:1}" stroke-linecap="round" x1="${(c+Math.cos(a)*r1).toFixed(1)}" y1="${(c+Math.sin(a)*r1).toFixed(1)}" x2="${(c+Math.cos(a)*r2).toFixed(1)}" y2="${(c+Math.sin(a)*r2).toFixed(1)}"/>`}
  [["N",0],["O",90],["S",180],["W",270]].forEach(([t,d])=>{const a=(d-90)*R;
    s+=`<text class="lbl${t==="N"?" n":""}" text-anchor="middle" dominant-baseline="central" x="${(c+Math.cos(a)*116).toFixed(1)}" y="${(c+Math.sin(a)*116).toFixed(1)}" transform="rotate(${d} ${(c+Math.cos(a)*116).toFixed(1)} ${(c+Math.sin(a)*116).toFixed(1)})">${t}</text>`});
  const a=(qTarget-90)*R,kx=c+Math.cos(a)*120,ky=c+Math.sin(a)*120;
  s+=`<line class="kaaba-line" x1="${(c+Math.cos(a)*76).toFixed(1)}" y1="${(c+Math.sin(a)*76).toFixed(1)}" x2="${(c+Math.cos(a)*104).toFixed(1)}" y2="${(c+Math.sin(a)*104).toFixed(1)}"/>
   <g transform="translate(${kx.toFixed(1)} ${ky.toFixed(1)}) rotate(${qTarget})"><circle class="kaaba-bg" r="15"/>
   <path class="kaaba" d="M-7 -4.5 0 -7.5 7 -4.5 7 5 0 8 -7 5Z"/><path d="M-7 -1 0 2 7 -1" fill="none" stroke="var(--accent)" stroke-width="1.4"/></g>`;
  $("rose").innerHTML=s;
}
function updateQiblaTarget(){
  qTarget=adhan.Qibla(new adhan.Coordinates(loc.lat,loc.lon));
  $("qMeta").textContent=`${Math.round(qTarget)}° ${compassName(qTarget)} · ${Math.round(distKm()).toLocaleString("de-DE")} km`;
  buildRose();
  if(!listening){$("heading").textContent=Math.round(qTarget)+"°";$("qHint").textContent="Qibla-Richtung";$("rose").style.transform="rotate(0deg)";}
}
function initQibla(){if(!qInit){qInit=true;updateQiblaTarget()}}
function onOrient(e){
  let h=null;
  if(typeof e.webkitCompassHeading==="number"&&!isNaN(e.webkitCompassHeading))h=e.webkitCompassHeading;
  else if(e.absolute&&e.alpha!=null)h=360-e.alpha;
  if(h==null)return;
  const so=(screen.orientation&&screen.orientation.angle)||window.orientation||0;h=(h+so+360)%360;
  lastEvt=Date.now();
  const x=Math.cos(h*R),y=Math.sin(h*R);
  if(sx==null){sx=x;sy=y}else{sx=sx*.82+x*.18;sy=sy*.82+y*.18}
  if(typeof e.webkitCompassAccuracy==="number"){
    const bad=e.webkitCompassAccuracy<0||e.webkitCompassAccuracy>25;
    $("qNote").textContent=bad?"Kompass ungenau: Beweg das iPhone ein paar Mal in Form einer Acht.":"Halte das iPhone flach vor dir und weg von Metall oder Magneten.";
  }
  if(!raf)raf=requestAnimationFrame(drawHeading);
}
let shown=null;
function drawHeading(){
  raf=0;const h=(Math.atan2(sy,sx)/R+360)%360;
  // kürzester Weg für die Drehung
  if(shown==null)shown=h;else{let d=((h-shown+540)%360)-180;shown+=d}
  $("rose").style.transform=`rotate(${-shown}deg)`;
  const diff=((qTarget-h+540)%360)-180,ad=Math.abs(diff),ok=ad<=3;
  $("heading").textContent=Math.round(h)+"°";
  $("qHint").textContent=ok?"Richtung stimmt":`${Math.round(ad)}° nach ${diff>0?"rechts":"links"}`;
  $("v-qibla").classList.toggle("aligned",ok);
  if(ok&&!wasAligned&&navigator.vibrate)navigator.vibrate(18);
  wasAligned=ok;
}
$("compassBtn").addEventListener("click",async()=>{
  const btn=$("compassBtn");
  try{
    if(typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function"){
      const r=await DeviceOrientationEvent.requestPermission();
      if(r!=="granted"){$("qNote").textContent="Kompasszugriff abgelehnt. Schließ die App ganz und öffne sie erneut, dann noch einmal auf „Kompass starten“ tippen.";return}
    }
  }catch(e){$("qNote").textContent="Der Kompass konnte nicht gestartet werden.";return}
  if(!listening){
    listening=true;
    if("ondeviceorientationabsolute" in window)window.addEventListener("deviceorientationabsolute",onOrient);
    window.addEventListener("deviceorientation",onOrient);
  }
  btn.hidden=true;$("qHint").textContent="Kompass wird gestartet …";
  setTimeout(()=>{if(!lastEvt){btn.hidden=false;$("qHint").textContent="Qibla-Richtung";
    $("qNote").textContent="Kein Kompass gefunden. Auf dem iPhone funktioniert er in Safari oder als App auf dem Homescreen.";}},2500);
});

/* ================= Quran ================= */
const API="https://api.alquran.cloud/v1";
const EDS="quran-uthmani,de.bubenheim,en.sahih,en.transliteration";
let qrInit=false,surahList=store.get("surahs",null),cache={},curSurah=null,activeKey=null,io=null;
function applyPrefs(){
  const v=$("verses");["ar","tr","de","en"].forEach(k=>{v.classList.toggle("no-"+k,!prefs[k]);$("t-"+k).checked=prefs[k]});
  document.documentElement.style.setProperty("--ar-size",prefs.size+"px");
}
function initQuran(){
  if(qrInit)return;qrInit=true;applyPrefs();updateMarksCount();
  if(surahList){renderIndex()}
  fetch(API+"/surah").then(r=>r.json()).then(j=>{if(j&&j.data){surahList=j.data.map(s=>({n:s.number,ar:s.name,en:s.englishName,m:s.englishNameTranslation,c:s.numberOfAyahs,r:s.revelationType}));store.set("surahs",surahList);renderIndex()}})
   .catch(()=>{if(!surahList)$("surahs").innerHTML=`<p class="empty">Keine Verbindung. Die Suren-Liste wird geladen, sobald du online bist.</p>`});
}
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const arName=s=>s.replace(/^سُورَةُ\s*/,"");
const AR_DIGITS="٠١٢٣٤٥٦٧٨٩";const arNum=n=>String(n).replace(/\d/g,d=>AR_DIGITS[d]);
const place=r=>r==="Medinan"?"Medina":"Mekka";
function renderIndex(){
  if(!surahList)return;
  const q=norm($("search").value||"");
  const list=surahList.filter(s=>!q||String(s.n)===q||norm(s.en).includes(q)||norm(s.m).includes(q));
  $("surahs").innerHTML=list.length?list.map(s=>`<button class="surah" data-n="${s.n}"><span class="no"><span>${s.n}</span></span><span class="nm"><b>${s.en}</b><span>${s.m}</span></span><span class="rt"><span class="ar">${arName(s.ar)}</span><small>${s.c} Verse</small></span></button>`).join("")
    :`<p class="empty">Keine Sure gefunden.</p>`;
  const box=$("resume");let h="";
  const card=(lbl,p,kind)=>surahList[p.s-1]?`<button class="card resume" data-kind="${kind}"><small>${lbl}</small><b>${surahList[p.s-1].en}</b><span>Vers ${p.a}</span></button>`:"";
  if(resume)h+=card("Zuletzt gelesen",resume,"resume");
  if(bookmark)h+=card("Lesezeichen",bookmark,"bookmark");
  box.innerHTML=h;box.hidden=!h;
}
$("search").addEventListener("input",renderIndex);
$("surahs").addEventListener("click",e=>{const b=e.target.closest(".surah");if(b)openSurah(+b.dataset.n)});
$("resume").addEventListener("click",e=>{const b=e.target.closest(".resume");if(!b)return;const p=b.dataset.kind==="bookmark"?bookmark:resume;if(p)openSurah(p.s,p.a)});

function showPane(p){["q-index","q-reader","q-marks"].forEach(id=>$(id).hidden=id!==p)}
async function loadSurah(n){
  if(cache[n])return cache[n];
  const r=await fetch(`${API}/surah/${n}/editions/${EDS}`);if(!r.ok)throw new Error("http");
  const j=await r.json();const [ar,de,en,tr]=j.data;
  const verses=ar.ayahs.map((a,i)=>{let t=a.text.replace(/^﻿/,"");
    if(i===0&&n!==1&&n!==9&&t.startsWith("بِسْمِ"))t=t.split(" ").slice(4).join(" ");
    return{a:a.numberInSurah,ar:t,de:de.ayahs[i].text,en:en.ayahs[i].text,tr:tr.ayahs[i].text}});
  return cache[n]={n,name:ar.englishName,meaning:ar.englishNameTranslation,arName:ar.name,rev:ar.revelationType,verses};
}
const ICON={
  hl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-5 5v3h3l5-5"/><path d="m14 6 4 4"/><path d="M9 11 16 4l4 4-7 7z"/></svg>',
  bm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  bmOn:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  cp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>'
};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function verseHTML(n,v){
  const k=`${n}:${v.a}`,m=marks[k],isBm=bookmark&&bookmark.s===n&&bookmark.a===v.a;
  return `<article class="verse${m?" hl-"+m.c:""}" id="v${v.a}" data-a="${v.a}">
    <div class="meta"><span class="num">${k}</span><span class="acts">
      <button data-act="hl" aria-label="Markieren" class="${m?"on":""}">${ICON.hl}</button>
      <button data-act="bm" aria-label="Lesezeichen" class="${isBm?"on":""}">${isBm?ICON.bmOn:ICON.bm}</button>
      <button data-act="cp" aria-label="Kopieren">${ICON.cp}</button></span></div>
    <div class="ar" lang="ar">${esc(v.ar)} <span class="end">۝${arNum(v.a)}</span></div>
    <div class="tr">${esc(v.tr)}</div>
    <div class="de" lang="de">${esc(v.de)}<span class="who">Bubenheim &amp; Elyas</span></div>
    <div class="en" lang="en">${esc(v.en)}<span class="who">Saheeh International</span></div></article>`;
}
async function openSurah(n,ayah){
  showPane("q-reader");window.scrollTo(0,0);
  const meta=surahList&&surahList[n-1];
  $("rName").textContent=meta?meta.en:`Sure ${n}`;$("rSub").textContent=meta?`Sure ${n}`:"";
  $("verses").innerHTML=`<p class="loading">Wird geladen …</p>`;
  let s;
  try{s=await loadSurah(n)}catch(e){$("verses").innerHTML=`<p class="loading">Keine Verbindung. Einmal geöffnete Suren sind danach auch offline verfügbar.</p>`;return}
  curSurah=s;
  $("rName").textContent=s.name;$("rSub").textContent=`Sure ${n}`;
  let h=`<header class="chapter"><div class="car" lang="ar">${arName(s.arName)}</div><b>${esc(s.name)}</b><span>${esc(s.meaning)} · ${place(s.rev)} · ${s.verses.length} Verse</span></header>`;
  if(n!==1&&n!==9)h+=`<div class="bismillah" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>`;
  h+=s.verses.map(v=>verseHTML(n,v)).join("");
  $("verses").innerHTML=h;applyPrefs();
  if(ayah&&ayah>1){const el=$("v"+ayah);if(el){el.scrollIntoView({block:"start"});el.classList.add("flash")}}
  watchReading(n);
}
function watchReading(n){
  if(io)io.disconnect();let t;
  io=new IntersectionObserver(()=>{
    const vis=[...document.querySelectorAll("#verses .verse")].filter(v=>{const r=v.getBoundingClientRect();return r.bottom>80&&r.top<window.innerHeight});
    if(!vis.length)return;clearTimeout(t);
    t=setTimeout(()=>{resume={s:n,a:+vis[0].dataset.a};store.set("resume",resume)},600);
  },{threshold:[0,1]});
  document.querySelectorAll("#verses .verse").forEach(v=>io.observe(v));
}
$("backBtn").addEventListener("click",()=>{if(io)io.disconnect();showPane("q-index");renderIndex();window.scrollTo(0,0)});

// Aktionen pro Vers
$("verses").addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]");if(!b||!curSurah)return;
  const art=b.closest(".verse"),a=+art.dataset.a,n=curSurah.n,k=`${n}:${a}`,v=curSurah.verses[a-1];
  if(b.dataset.act==="hl"){
    activeKey=k;$("vsTitle").textContent=`${curSurah.name} · Vers ${a}`;
    const c=marks[k]?marks[k].c:"";
    document.querySelectorAll("#swatches button").forEach(x=>x.classList.toggle("on",x.dataset.c===c&&c!==""));
    openSheet("verseSheet");
  }else if(b.dataset.act==="bm"){
    const old=bookmark;
    if(old&&old.s===n&&old.a===a){bookmark=null;toast("Lesezeichen entfernt")}else{bookmark={s:n,a};toast("Lesezeichen gesetzt")}
    store.set("bookmark",bookmark);
    if(old&&old.s===n&&$("v"+old.a))$("v"+old.a).outerHTML=verseHTML(n,curSurah.verses[old.a-1]);
    if(bookmark)$("v"+a).outerHTML=verseHTML(n,v);
    watchReading(n);
  }else if(b.dataset.act==="cp"){
    const txt=[prefs.ar?v.ar:"",prefs.tr?v.tr:"",prefs.de?v.de:"",prefs.en?v.en:"",`(${curSurah.name} ${k})`].filter(Boolean).join("\n\n");
    try{await navigator.clipboard.writeText(txt);toast("Kopiert")}catch(err){toast("Kopieren nicht möglich")}
  }
});
$("swatches").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b||!activeKey)return;
  const c=b.dataset.c,a=+activeKey.split(":")[1],verse=curSurah.verses[a-1];
  if(c){marks[activeKey]={c,t:verse.de.slice(0,160)};toast("Markiert")}else{delete marks[activeKey];toast("Markierung entfernt")}
  store.set("marks",marks);updateMarksCount();
  const el=$("v"+a);if(el)el.outerHTML=verseHTML(curSurah.n,verse);watchReading(curSurah.n);
  closeSheet();
});

/* ================= Hadith des Tages ================= */
const HAPI="https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const HCOL=[{k:"bukhari",name:"Sahih al-Bukhari",max:7000},{k:"muslim",name:"Sahih Muslim",max:7000},{k:"nawawi",name:"40 Hadith an-Nawawi",max:42}];
function dayIndex(){const d=new Date();return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()))/864e5)}
function hash(n){n=(n^61)^(n>>>16);n=n+(n<<3);n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return n>>>0}
const usable=t=>t&&t.length>=80&&t.length<=1100&&/(Prophet|Messenger|Apostle|Allah)/.test(t);
async function getHadith(col,num){
  const [en,ar]=await Promise.all([fetch(`${HAPI}/eng-${col.k}/${num}.json`).then(r=>r.ok?r.json():null),fetch(`${HAPI}/ara-${col.k}/${num}.json`).then(r=>r.ok?r.json():null)]);
  const e=en&&en.hadiths&&en.hadiths[0],a=ar&&ar.hadiths&&ar.hadiths[0];
  if(!e||!usable(e.text))return null;
  return{src:`${col.name} ${e.hadithnumber}`,en:e.text.trim(),ar:a?a.text.trim():""};
}
async function loadHadith(){
  const day=dayIndex(),cached=store.get("hadith",null);
  if(cached&&cached.day===day)return showHadith(cached);
  const col=HCOL[day%HCOL.length];let num=(hash(day)%col.max)+1,h=null;
  try{for(let i=0;i<8&&!h;i++){h=await getHadith(col,((num-1+i)%col.max)+1)}}catch(e){}
  if(h){h.day=day;store.set("hadith",h);showHadith(h)}
  else if(cached)showHadith(cached);
  else{$("hEn").textContent="Gerade keine Verbindung. Der Hadith erscheint, sobald du online bist."}
}
function showHadith(h){
  $("hSrc").textContent=h.src;$("hAr").textContent=h.ar;$("hEn").textContent=h.en;
  const card=$("hadith");card.classList.add("clamp");
  requestAnimationFrame(()=>{const over=$("hEn").scrollHeight>$("hEn").clientHeight+2||$("hAr").scrollHeight>$("hAr").clientHeight+2;$("hMore").hidden=!over;$("hMore").textContent="Ganz lesen"});
}
$("hMore").addEventListener("click",()=>{const c=$("hadith").classList.toggle("clamp");$("hMore").textContent=c?"Ganz lesen":"Weniger"});

// Anzeige
$("viewBtn").addEventListener("click",()=>openSheet("viewSheet"));
["ar","tr","de","en"].forEach(k=>$("t-"+k).addEventListener("change",e=>{prefs[k]=e.target.checked;
  if(!prefs.ar&&!prefs.tr&&!prefs.de&&!prefs.en){prefs.ar=true}store.set("prefs",prefs);applyPrefs()}));
document.querySelectorAll("[data-size]").forEach(b=>b.addEventListener("click",()=>{
  prefs.size=Math.max(20,Math.min(44,prefs.size+4*(+b.dataset.size)));store.set("prefs",prefs);applyPrefs()}));

// Markierungen
function updateMarksCount(){const n=Object.keys(marks).length;$("marksCount").textContent=n?`${n} markiert`:"Markiert"}
$("marksBtn").addEventListener("click",()=>{
  showPane("q-marks");window.scrollTo(0,0);
  const keys=Object.keys(marks).sort((x,y)=>{const[a,b]=x.split(":").map(Number),[c,d]=y.split(":").map(Number);return a-c||b-d});
  $("marksSub").textContent=keys.length?`${keys.length} Verse`:"";
  $("marksList").innerHTML=keys.length?keys.map(k=>{const s=+k.split(":")[0],nm=surahList&&surahList[s-1]?surahList[s-1].en:`Sure ${s}`;
    return `<button class="mark" data-k="${k}"><span class="h"><i style="background:var(--sw-${marks[k].c})"></i>${nm} · ${k}</span><p>${(marks[k].t||"").replace(/[&<>]/g,"")}</p></button>`}).join("")
    :`<p class="empty">Noch nichts markiert. Tipp im Quran beim Vers auf den Marker, um ihn farbig zu markieren.</p>`;
});
$("marksList").addEventListener("click",e=>{const b=e.target.closest(".mark");if(!b)return;const[s,a]=b.dataset.k.split(":").map(Number);openSurah(s,a)});
$("marksBack").addEventListener("click",()=>{showPane("q-index");window.scrollTo(0,0)});

/* ================= Start ================= */
renderTimes();
loadHadith();
setInterval(()=>{if(view==="times"&&!document.hidden)renderTimes()},15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&view==="times")renderTimes()});
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
