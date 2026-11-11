// Falak – Quran: Suren, Leser, Markierungen, Anzeige, Sicherung
"use strict";

/* ================= Quran ================= */
const API="https://api.alquran.cloud/v1";
const EDS="quran-uthmani,de.bubenheim,en.sahih,en.transliteration";
let qrInit=false,surahList=(store.get("surahs",null)||null),cache={},curSurah=null,activeKey=null,io=null;
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
function renderIndex(){
  if(!surahList)return;
  const q=norm($("search").value||"");
  const list=surahList.filter(s=>!q||String(s.n)===q||norm(s.en).includes(q)||norm(SURAH_DE[s.n-1]).includes(q));
  $("surahs").innerHTML=list.length?list.map(s=>`<button class="surah" data-n="${s.n}"><span class="no"><span>${s.n}</span></span><span class="nm"><b>${esc(s.en)}</b><span>${esc(SURAH_DE[s.n-1]||s.m)}</span></span><span class="rt"><span class="ar">${esc(arName(s.ar))}</span></span></button>`).join("")
    :`<p class="empty">Keine Sure gefunden.</p>`;
  const box=$("resume");let h="";
  const card=(lbl,p,kind)=>surahList[p.s-1]?`<button class="resume" data-kind="${kind}"><small>${lbl}</small><b>${esc(surahList[p.s-1].en)} <span>· Vers ${p.a}</span></b></button>`:"";
  if(resume)h+=card("Zuletzt gelesen",resume,"resume");
  if(bookmark)h+=card("Lesezeichen",bookmark,"bookmark");
  box.innerHTML=h;box.hidden=!h;
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
  bm:'<svg><use href="#i-bm"/></svg>',
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
async function openSurah(n,ayah){
  showPane("q-reader");window.scrollTo(0,0);
  const meta=surahList&&surahList[n-1];
  $("rName").textContent=meta?meta.en:`Sure ${n}`;$("rSub").textContent=meta?`Sure ${n}`:"";
  $("verses").innerHTML=`<p class="loading">Wird geladen …</p>`;
  let s;
  try{s=await loadSurah(n)}catch(e){$("verses").innerHTML=`<p class="loading">Keine Verbindung. Einmal geöffnete Suren sind danach auch offline verfügbar.</p>`;return}
  curSurah=s;
  $("rName").textContent=s.name;$("rSub").textContent=`Sure ${n}`;
  let h=`<header class="chapter"><div class="car" lang="ar">${esc(arName(s.arName))}</div><b>${esc(s.name)}</b><span>${esc(SURAH_DE[n-1]||s.meaning)} · ${place(s.rev)} · ${s.verses.length} Verse</span><small class="trn de">Deutsch: Bubenheim &amp; Elyas</small><small class="trn en">Englisch: Saheeh International</small></header>`;
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

// Anzeige
$("viewBtn").addEventListener("click",()=>openSheet("viewSheet"));
["ar","tr","de","en"].forEach(k=>$("t-"+k).addEventListener("change",e=>{prefs[k]=e.target.checked;
  if(!prefs.ar&&!prefs.tr&&!prefs.de&&!prefs.en){prefs.ar=true}store.set("prefs",prefs);applyPrefs()}));
document.querySelectorAll("[data-size]").forEach(b=>b.addEventListener("click",()=>{
  prefs.size=Math.max(18,Math.min(36,prefs.size+2*(+b.dataset.size)));store.set("prefs",prefs);applyPrefs()}));

// Markierungen
function updateMarksCount(){const n=Object.keys(marks).length;$("marksCount").textContent=n||""}
$("marksBtn").addEventListener("click",()=>{
  showPane("q-marks");window.scrollTo(0,0);
  const keys=Object.keys(marks).sort((x,y)=>{const[a,b]=x.split(":").map(Number),[c,d]=y.split(":").map(Number);return a-c||b-d});
  $("marksSub").textContent=keys.length?`${keys.length} Verse`:"";
  $("marksList").innerHTML=keys.length?keys.map(k=>{const s=+k.split(":")[0],nm=surahList&&surahList[s-1]?esc(surahList[s-1].en):`Sure ${s}`;
    return `<button class="mark" data-k="${k}"><span class="h"><i style="background:var(--sw-${marks[k].c})"></i>${nm} · ${k}</span><p>${(marks[k].t||"").replace(/[&<>]/g,"")}</p></button>`}).join("")
    :`<p class="empty">Noch nichts markiert. Tipp im Quran beim Vers auf den Marker, um ihn farbig zu markieren.</p>`;
});
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
  try{const j=JSON.parse(await f.text());if(j.app!=="falak"&&j.app!=="miqat")throw 0;
    marks=Object.assign({},marks,j.marks||{});store.set("marks",marks);
    if(j.bookmark){bookmark=j.bookmark;store.set("bookmark",bookmark)}
    if(j.resume){resume=j.resume;store.set("resume",resume)}
    updateMarksCount();toast(`${Object.keys(j.marks||{}).length} Markierungen geladen`);
  }catch(err){toast("Diese Datei ist keine Falak-Sicherung")}
  e.target.value="";
});
