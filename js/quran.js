// Falak – Quran: Suren, Leser, Markierungen, Anzeige, Sicherung
"use strict";

/* ================= Quran ================= */
const API="https://api.alquran.cloud/v1";
const EDS="quran-uthmani,de.bubenheim,en.sahih,en.transliteration";
let qrInit=false,surahList=(store.get("surahs",null)||null),cache={},curSurah=null,activeKey=null,io=null,ioVis=null;
function applyPrefs(){
  const v=$("verses");["ar","tr","de","en"].forEach(k=>{v.classList.toggle("no-"+k,!prefs[k]);$("t-"+k).checked=prefs[k]});
  document.documentElement.style.setProperty("--ar-size",prefs.size+"px");
}
function initQuran(){
  if(qrInit)return;qrInit=true;applyPrefs();updateMarksCount();
  if(surahList){renderIndex()}
  fetch(API+"/surah").then(r=>r.json()).then(j=>{if(j&&j.data){surahList=j.data.map(s=>({n:s.number,ar:s.name,en:s.englishName,m:SURAH_DE[s.number-1]||s.englishNameTranslation,c:s.numberOfAyahs,r:s.revelationType}));store.set("surahs",surahList);renderIndex()}})
   .catch(()=>{if(!surahList)$("surahs").innerHTML=`<p class="empty">Keine Verbindung. Die Suren-Liste wird geladen, sobald du online bist.</p>`});
}
const SURAH_DE=["Die Eröffnende", "Die Kuh", "Die Sippe Imrans", "Die Frauen", "Der Tisch", "Das Vieh", "Die Höhen", "Die Beute", "Die Reue", "Yunus", "Hud", "Yusuf", "Der Donner", "Ibrahim", "Al-Hidschr", "Die Bienen", "Die Nachtreise", "Die Höhle", "Maryam", "Ta-Ha", "Die Propheten", "Die Pilgerfahrt", "Die Gläubigen", "Das Licht", "Die Unterscheidung", "Die Dichter", "Die Ameisen", "Die Geschichte", "Die Spinne", "Die Römer", "Luqman", "Die Niederwerfung", "Die Gruppierungen", "Saba", "Der Erschaffer", "Ya-Sin", "Die sich Reihenden", "Sad", "Die Scharen", "Der Vergebende", "Ausführlich dargelegt", "Die Beratung", "Der Goldschmuck", "Der Rauch", "Die Kniende", "Die Sanddünen", "Muhammad", "Der Sieg", "Die Gemächer", "Qaf", "Die Aufwirbelnden", "Der Berg", "Der Stern", "Der Mond", "Der Allerbarmer", "Das eintreffende Ereignis", "Das Eisen", "Der Streit", "Die Versammlung", "Die Geprüfte", "Die Reihe", "Der Freitag", "Die Heuchler", "Die Übervorteilung", "Die Scheidung", "Das Verbot", "Die Herrschaft", "Das Schreibrohr", "Die fällige Stunde", "Die Himmelswege", "Nuh", "Die Dschinn", "Der Eingehüllte", "Der Zugedeckte", "Die Auferstehung", "Der Mensch", "Die Entsandten", "Die Kunde", "Die Entreißenden", "Er runzelte die Stirn", "Das Umschlingen", "Das Zerbrechen", "Die das Maß Kürzenden", "Das Zerreißen", "Die Türme", "Der Pochende", "Der Höchste", "Die Überdeckende", "Die Morgendämmerung", "Die Stadt", "Die Sonne", "Die Nacht", "Der Vormittag", "Das Auftun", "Die Feige", "Das Anhängsel", "Die Bestimmung", "Der klare Beweis", "Das Beben", "Die Rennenden", "Das Verhängnis", "Die Vermehrung", "Die Zeit", "Der Stichler", "Der Elefant", "Quraisch", "Die Hilfeleistung", "Die Fülle", "Die Ungläubigen", "Die Hilfe", "Die Palmfasern", "Die Aufrichtigkeit", "Das Frühlicht", "Die Menschen"];
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const arName=s=>s.replace(/^سُورَةُ\s*/,"");
const AR_DIGITS="٠١٢٣٤٥٦٧٨٩";const arNum=n=>String(n).replace(/\d/g,d=>AR_DIGITS[d]);
const place=r=>r==="Medinan"?"Medina":"Mekka";
// Suchschlüssel („englischer Name|deutscher Name“, normalisiert) einmal pro Sure berechnen statt bei jedem Tastendruck für alle 114
let surahKeys=null;
function renderIndex(){
  if(!surahList)return;
  const q=norm($("search").value||"");
  if(!surahKeys||surahKeys.length!==surahList.length)surahKeys=surahList.map(s=>norm(s.en)+"|"+norm(SURAH_DE[s.n-1]));
  const list=surahList.filter((s,i)=>!q||String(s.n)===q||surahKeys[i].includes(q));
  setHTML($("surahs"),list.length?list.map(s=>`<button class="surah" data-n="${s.n}"><span class="no"><span>${s.n}</span></span><span class="nm"><b>${esc(s.en)}</b><span>${esc(SURAH_DE[s.n-1]||s.m)}</span></span><span class="rt"><span class="ar">${esc(arName(s.ar))}</span></span></button>`).join("")
    :`<p class="empty">Keine Sure gefunden.</p>`);
  const box=$("resume");let h="";
  const card=(lbl,p,kind)=>surahList[p.s-1]?`<button class="resume" data-kind="${kind}"><small>${lbl}</small><b>${esc(surahList[p.s-1].en)} <span>· Vers ${p.a}</span></b></button>`:"";
  if(resume)h+=card("Zuletzt gelesen",resume,"resume");
  if(bookmark)h+=card("Lesezeichen",bookmark,"bookmark");
  setHTML(box,h);box.hidden=!h;
}
$("search").addEventListener("input",renderIndex);
function setSearch(open){
  $("searchWrap").hidden=!open;$("searchBtn").setAttribute("aria-expanded",String(open));
  if(open){$("search").focus()}else{$("search").value="";$("search").blur();renderIndex()}
}
$("searchBtn").addEventListener("click",()=>setSearch($("searchWrap").hidden));
$("searchClose").addEventListener("click",()=>setSearch(false));
$("search").addEventListener("blur",()=>{setTimeout(()=>{if(!$("search").value&&document.activeElement!==$("search"))setSearch(false)},150)});
$("surahs").addEventListener("click",e=>{const b=e.target.closest(".surah");if(b)openSurah(+b.dataset.n)});
$("resume").addEventListener("click",e=>{const b=e.target.closest(".resume");if(!b)return;const p=b.dataset.kind==="bookmark"?bookmark:resume;if(p)openSurah(p.s,p.a)});

function showPane(p){const was=["q-index","q-reader","q-marks"].find(id=>!$(id).hidden);["q-index","q-reader","q-marks"].forEach(id=>$(id).hidden=id!==p);if(was&&was!==p)slideIn($(p),p==="q-index"?-1:1)}
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
  hl:'<svg><use href="#i-hl"/></svg>',
  bm:'<svg><use href="#i-bm-o"/></svg>',
  bmOn:'<svg><use href="#i-bm-f"/></svg>',
  cp:'<svg><use href="#i-copy"/></svg>'
};
function verseHTML(n,v){
  const k=`${n}:${v.a}`,m=marks[k],isBm=bookmark&&bookmark.s===n&&bookmark.a===v.a;
  return `<article class="verse${m?" hl-"+m.c:""}" id="v${v.a}" data-a="${v.a}">
    <div class="meta"><span class="num">${k}</span><span class="acts">
      <button data-act="hl" aria-label="Markieren" class="${m?"on":""}"${m?` style="color:var(--sw-${m.c})"`:""}>${ICON.hl}</button>
      <button data-act="bm" aria-label="Lesezeichen" class="${isBm?"on":""}">${isBm?ICON.bmOn:ICON.bm}</button>
      <button data-act="cp" aria-label="Kopieren">${ICON.cp}</button></span></div>
    <div class="ar" lang="ar">${esc(v.ar)} <span class="end">${arNum(v.a)}</span></div>
    <div class="tr">${esc(v.tr)}</div>
    <div class="de" lang="de">${esc(v.de)}</div>
    <div class="en" lang="en">${esc(v.en)}</div></article>`;
}
// Lange Suren (Al-Baqara: 286 Verse) erscheinen sofort mit den ersten Versen; der Rest wird direkt darunter nachgereicht (je Bild ein Block).
// Nachgereicht wird nur unterhalb des Sichtbaren, darüber verschiebt sich nichts. Beim Sprung zu einem Vers sind alle Verse bis kurz dahinter sofort da.
const FIRST_VERSES=30,CHUNK_VERSES=40;let renderTok=0;
function fillVerses(s,from,tok){
  if(tok!==renderTok||curSurah!==s)return;
  const to=Math.min(s.verses.length,from+CHUNK_VERSES);
  $("verses").insertAdjacentHTML("beforeend",s.verses.slice(from,to).map(v=>verseHTML(s.n,v)).join(""));
  if(io)for(let i=from;i<to;i++){const el=$("v"+s.verses[i].a);if(el)io.observe(el)}
  if(to<s.verses.length)requestAnimationFrame(()=>fillVerses(s,to,tok));
}
// Beim Öffnen einer Sure blenden Kopf, Basmala und die ersten Verse leicht gestaffelt ein (nur Deckkraft und 8 px Hub; einmal, nie beim Scrollen)
function introAnim(){
  if(reduceMotion.matches)return;
  const els=[...document.querySelectorAll("#verses .chapter>*, #verses .bismillah, #verses .verse:nth-of-type(-n+2)")];
  els.forEach((el,i)=>el.animate([{opacity:0,transform:"translateY(8px)"},{opacity:1,transform:"none"}],{duration:300,delay:i*40,easing:EASE,fill:"backwards"}));
}
// Kopfzeile in der Sure: nach dem Scrollen Titel und Abdunklung einblenden; abwärts wegfahren, aufwärts zurück
let lastY=0;
window.addEventListener("scroll",()=>{
  const r=$("q-reader");if(r.hidden)return;
  const y=window.scrollY,dy=y-lastY;lastY=y;
  r.classList.toggle("rd-sc",y>120);
  if(y<=120||dy<-6)r.classList.remove("rd-hide");else if(dy>6)r.classList.add("rd-hide");
},{passive:true});
async function openSurah(n,ayah){
  const tok=++renderTok;
  showPane("q-reader");window.scrollTo(0,0);
  $("q-reader").classList.remove("rd-sc","rd-hide");lastY=0;
  const meta=surahList&&surahList[n-1];
  $("rName").textContent=meta?meta.en:`Sure ${n}`;$("rSub").textContent=meta?`Sure ${n}`:"";
  $("verses").innerHTML=`<p class="loading">Wird geladen …</p>`;
  let s;
  try{s=await loadSurah(n)}catch(e){$("verses").innerHTML=`<p class="loading">Keine Verbindung. Einmal geöffnete Suren sind danach auch offline verfügbar.</p>`;return}
  if(tok!==renderTok)return;   // inzwischen wurde eine andere Sure oder die Liste geöffnet
  curSurah=s;
  $("rName").textContent=s.name;$("rSub").textContent=`Sure ${n}`;
  let h=`<header class="chapter"><div class="car" lang="ar">${esc(arName(s.arName))}</div><b>${esc(s.name)}</b><hr><span>${esc(SURAH_DE[n-1]||s.meaning)} · ${place(s.rev)} · ${s.verses.length} Verse</span></header>`;
  if(n!==1&&n!==9)h+=`<div class="bismillah" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>`;
  const first=Math.min(s.verses.length,ayah&&ayah>1?ayah+25:FIRST_VERSES);
  h+=s.verses.slice(0,first).map(v=>verseHTML(n,v)).join("");
  $("verses").innerHTML=h;applyPrefs();
  if(!(ayah&&ayah>1))introAnim();
  if(ayah&&ayah>1){const el=$("v"+ayah);if(el){el.scrollIntoView({block:"start"});el.classList.add("flash")}}
  watchReading(n);
  if(first<s.verses.length)requestAnimationFrame(()=>fillVerses(s,first,tok));
}
function watchReading(n){
  if(io)io.disconnect();let t;
  const vis=ioVis=new Set(); // Verse im sichtbaren Bereich (unter der Kopfzeile), nach Meldungen des Beobachters gepflegt
  io=new IntersectionObserver(es=>{
    es.forEach(e=>e.isIntersecting?vis.add(e.target):vis.delete(e.target));
    if(!vis.size)return;clearTimeout(t);
    t=setTimeout(()=>{let a=Infinity;vis.forEach(v=>{a=Math.min(a,+v.dataset.a)});resume={s:n,a};store.set("resume",resume)},600);
  },{rootMargin:"-80px 0px 0px 0px"});
  document.querySelectorAll("#verses .verse").forEach(v=>io.observe(v));
}
// Nach dem Austausch eines einzelnen Verses (Markierung, Lesezeichen) nur diesen neu beobachten; der Rest bleibt unverändert beim Beobachter
function reobserve(oldEl,id){const el=$(id);if(!io||!el)return;if(oldEl){io.unobserve(oldEl);if(ioVis)ioVis.delete(oldEl)}io.observe(el)}
$("backBtn").addEventListener("click",()=>{renderTok++;if(io)io.disconnect();showPane("q-index");renderIndex();window.scrollTo(0,0)});

// Aktionen pro Vers
$("verses").addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]");
  // Vers antippen blendet Markieren, Lesezeichen und Kopieren ein; erneutes Antippen blendet sie aus
  if(!b){const v=e.target.closest(".verse");if(v){const was=v.classList.contains("open");document.querySelectorAll("#verses .verse.open").forEach(x=>x.classList.remove("open"));if(!was)v.classList.add("open")}return}
  if(!curSurah)return;
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
    if(old&&old.s===n&&$("v"+old.a)){const oe=$("v"+old.a);oe.outerHTML=verseHTML(n,curSurah.verses[old.a-1]);reobserve(oe,"v"+old.a)}
    if(bookmark){const oe=$("v"+a);oe.outerHTML=verseHTML(n,v);reobserve(oe,"v"+a)}
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
  const el=$("v"+a);if(el){el.outerHTML=verseHTML(curSurah.n,verse);reobserve(el,"v"+a)}
  closeSheet();
});

// Anzeige
$("viewBtn").addEventListener("click",()=>openSheet("viewSheet"));
["ar","tr","de","en"].forEach(k=>$("t-"+k).addEventListener("change",e=>{prefs[k]=e.target.checked;
  if(!prefs.ar&&!prefs.tr&&!prefs.de&&!prefs.en){prefs.ar=true}store.set("prefs",prefs);applyPrefs()}));
document.querySelectorAll("[data-size]").forEach(b=>b.addEventListener("click",()=>{
  prefs.size=Math.max(18,Math.min(36,prefs.size+2*(+b.dataset.size)));store.set("prefs",prefs);applyPrefs()}));

// Markierungen
function updateMarksCount(){const n=Object.keys(marks).length;$("marksCount").textContent=n||""}
function renderMarks(){
  const keys=Object.keys(marks).sort((x,y)=>{const[a,b]=x.split(":").map(Number),[c,d]=y.split(":").map(Number);return a-c||b-d});
  $("marksSub").textContent=keys.length?`${keys.length} Verse`:"";
  $("marksList").innerHTML=keys.length?keys.map(k=>{const s=+k.split(":")[0],nm=surahList&&surahList[s-1]?esc(surahList[s-1].en):`Sure ${s}`;
    return `<button class="mark" data-k="${k}"><span class="h"><i style="background:var(--sw-${marks[k].c})"></i>${nm} · ${k}</span><p>${(marks[k].t||"").replace(/[&<>]/g,"")}</p></button>`}).join("")
    :`<p class="empty">Noch nichts markiert. Tipp im Quran beim Vers auf den Marker, um ihn farbig zu markieren.</p>`;
}
$("marksBtn").addEventListener("click",()=>{showPane("q-marks");window.scrollTo(0,0);renderMarks()});
$("marksList").addEventListener("click",e=>{const b=e.target.closest(".mark");if(!b)return;const[s,a]=b.dataset.k.split(":").map(Number);openSurah(s,a)});
$("marksBack").addEventListener("click",()=>{showPane("q-index");window.scrollTo(0,0)});

/* ================= Sicherung ================= */
$("storeHint").textContent=standalone?"Markierungen liegen nur auf diesem Gerät. Eine Sicherung schützt sie beim Gerätewechsel.":"Tipp: Als App auf dem Homescreen bleiben Markierungen zuverlässiger gespeichert als in Safari.";
$("backupBtn").addEventListener("click",async()=>{
  const data=JSON.stringify({app:"falak",v:1,date:new Date().toISOString(),marks,bookmark,resume,prefs,settings,loc},null,1);
  const name=`falak-sicherung-${new Date().toISOString().slice(0,10)}.json`;
  const file=new File([data],name,{type:"application/json"});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Falak-Sicherung"});return}}catch(e){if(e&&e.name==="AbortError")return}
  const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);toast("Sicherung gespeichert");
});
$("restoreIn").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  try{const j=JSON.parse(await f.text());if(j.app!=="falak")throw 0;
    // Datei prüfen: nur gültige Verse („Sure:Vers“), bekannte Farben, Zahlen als Zahlen (die Werte landen später im HTML)
    const okM={};Object.entries(j.marks||{}).forEach(([k,m])=>{if(/^\d{1,3}:\d{1,3}$/.test(k)&&m&&["yellow","green","blue","pink"].includes(m.c))okM[k]={c:m.c,t:String(m.t||"").slice(0,160)}});
    const okP=p=>p&&Number.isInteger(+p.s)&&Number.isInteger(+p.a)&&+p.s>=1&&+p.s<=114&&+p.a>=1?{s:+p.s,a:+p.a}:null;
    marks=Object.assign({},marks,okM);store.set("marks",marks);
    if(okP(j.bookmark)){bookmark=okP(j.bookmark);store.set("bookmark",bookmark)}
    if(okP(j.resume)){resume=okP(j.resume);store.set("resume",resume)}
    updateMarksCount();renderMarks();toast(`${Object.keys(okM).length} Markierungen geladen`);
  }catch(err){toast("Diese Datei ist keine Falak-Sicherung")}
  e.target.value="";
});
