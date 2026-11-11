// Falak – Grundlagen: Hilfsfunktionen, Speicher, Toast, Bewegung, Ansichten, Sheets
// Alle Dateien unter js/ teilen sich einen gemeinsamen Gültigkeitsbereich (klassische Skripte, Reihenfolge in index.html).
"use strict";

const $=id=>document.getElementById(id);
const R=Math.PI/180;
// Texte aus fremden Quellen (Quran-API) nie ungeprüft ins HTML
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ================= Speicher ================= */
// Aufräumen: Miqat-Einträge (vor dem Umbenennen) übernehmen, falls noch nicht geschehen, und dann löschen.
// Dazu die Reste der früheren Mitteilungs-Erinnerung, die durch den Kalender ersetzt ist.
try{const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("miqat."))old.push(k)}
  old.forEach(k=>{const n="falak."+k.slice(6);if(localStorage.getItem(n)==null)localStorage.setItem(n,localStorage.getItem(k));localStorage.removeItem(k)});
  ["falak.remind","falak.fired"].forEach(k=>localStorage.removeItem(k))}catch(e){}
const store={
  get(k,d){try{const v=localStorage.getItem("falak."+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem("falak."+k,JSON.stringify(v))}catch(e){}}
};
let loc=store.get("loc",{name:"Bremen",lat:53.07,lon:8.85});
let prefs=Object.assign({ar:true,tr:false,de:true,en:false,size:24},store.get("prefs",{}));
if("v2" in prefs){delete prefs.v2;store.set("prefs",prefs)}
// Feste Berechnung wie Athan Utility. Nur das Hijri-Datum lässt sich um bis zu zwei Tage verschieben (Mondsichtung der eigenen Moschee).
const settings={method:"MuslimWorldLeague",asr:"standard",hijri:Math.max(-2,Math.min(2,+store.get("hijri",0)||0))};
let adj=store.get("adj",{})||{};
let marks=store.get("marks",{});          // "2:255" -> {c:"yellow", t:"Snippet"}
let resume=store.get("resume",null);       // zuletzt gelesen {s,a}
let bookmark=store.get("bookmark",null);   // Lesezeichen {s,a}
const standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
// In Safari (nicht als Homescreen-App) bekommt der Bereich um Notch und Uhrzeit die Farbe des oberen Himmelsrands
document.body.classList.toggle("browser",!standalone);
const metaTheme=document.querySelector('meta[name="theme-color"]');
// Safari bis iOS 18 färbt diesen Bereich nach theme-color, ab iOS 26 nach dem fixierten Streifen .tint (siehe app.css)
function updTint(){
  if(standalone||!metaTheme)return;
  const on=view==="times"&&!document.body.classList.contains("scrolled");
  const c=on&&getComputedStyle(document.body).getPropertyValue("--tint").trim()||"#000000";
  if(metaTheme.content!==c)metaTheme.content=c;
}
// Dauerhaften Speicher anfragen (Safari gewährt ihn vor allem der Homescreen-App)
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}

/* ================= Toast ================= */
let toastT;
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),1700)}

/* ================= Bewegung ================= */
// Tiefer in die App (Quran, Sure) schiebt die neue Ansicht von rechts herein, zurück von links.
// Kurz (220 ms), nur transform und opacity; bei „Bewegung reduzieren“ nur ein leichtes Einblenden.
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
const EASE="cubic-bezier(.23,1,.32,1)";
function slideIn(el,dir,dist=18,dur=220){
  if(!el||!el.animate)return;
  const k=reduceMotion.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:`translateX(${dir*dist}px)`},{opacity:1,transform:"none"}];
  el.animate(k,{duration:reduceMotion.matches?140:dur,easing:EASE});
}

/* ================= Ansichten ================= */
// Keine Tabbar mehr: „Quran“ in der Kapsel neben „Qibla“ öffnet den Quran, Zurück-Pfeil (oder Zurück-Geste) führt heim
let view="times";const scrollMem={};const TABS=["times","quran","dhikr"];
function setView(v){
  if(v===view)return;
  scrollMem[view]=window.scrollY;
  view=v;
  TABS.forEach(n=>{$("v-"+n).hidden=n!==v});
  slideIn($("v-"+v),v==="times"?-1:1);
  window.scrollTo(0,scrollMem[v]||0);
  if(v!=="times")stopQibla();
  $("atmo").style.transition="";
  if(v==="times")requestAnimationFrame(()=>window.dispatchEvent(new Event("scroll")));
  document.body.classList.toggle("on-times",v==="times");
  if(v==="quran")initQuran();
  if(v==="dhikr")renderDz();
  if(v==="times")renderTimes();
  updTint();
}
$("quranBtn").addEventListener("click",()=>{history.pushState({v:"quran"},"");setView("quran")});
$("homeBtn").addEventListener("click",()=>{if(history.state&&history.state.v==="quran")history.back();else setView("times")});
// Beim Scrollen tritt der Himmel zurück: Licht und Sterne verblassen, leichte Parallaxe
(()=>{const a=$("atmo");let tick=false;
  const upd=()=>{tick=false;if(view!=="times")return;const y=Math.max(0,window.scrollY);
    a.style.transition="none";a.style.setProperty("--sf",Math.max(0,1-y/220).toFixed(3));a.style.transform=y?`translateY(${(-y*.25).toFixed(1)}px)`:""};
  window.addEventListener("scroll",()=>{if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});
})();
window.addEventListener("popstate",e=>setView(e.state&&TABS.includes(e.state.v)?e.state.v:"times"));

/* ================= Sheets ================= */
let openSheetEl=null;
function openSheet(id){closeSheet(true);openSheetEl=$(id);$("scrim").classList.add("open");openSheetEl.classList.add("open")}
function closeSheet(instant){if(!openSheetEl)return;const was=openSheetEl;openSheetEl.classList.remove("open");$("scrim").classList.remove("open");openSheetEl=null;
  if(was.id==="adjSheet"){adjKey=null;renderTimes()}}
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
