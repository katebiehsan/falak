(function(){
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

/* ================= Hijri ================= */
const HMONTH=["Muharram","Safar","Rabi al-Awwal","Rabi al-Thani","Jumada al-Ula","Jumada al-Akhira","Rajab","Shaban","Ramadan","Shawwal","Dhul-Qada","Dhul-Hijja"];
const HF=(()=>{try{return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn",{day:"numeric",month:"numeric",year:"numeric"})}catch(e){return null}})();
function hParts(date){
  if(!HF)return null;
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()+settings.hijri,12);
  const p={};HF.formatToParts(d).forEach(x=>{if(x.type==="day"||x.type==="month"||x.type==="year")p[x.type]=parseInt(x.value,10)});
  return p.day?{d:p.day,m:p.month,y:p.year}:null;
}
function hijriText(date){const h=hParts(date);return h?`${h.d}. ${HMONTH[h.m-1]} ${h.y}`:""}

/* ================= Gebetszeiten ================= */
const PRAYERS=[["fajr","Fajr"],["sunrise","Shuruq"],["dhuhr","Dhuhr"],["asr","Asr"],["maghrib","Maghrib"],["isha","Isha"]];
const LABEL=Object.fromEntries(PRAYERS);
let dayOffset=0;
function params(){
  const p=adhan.CalculationMethod.MuslimWorldLeague();
  p.madhab=adhan.Madhab.Shafi;
  p.highLatitudeRule=adhan.HighLatitudeRule.SeventhOfTheNight;return p;
}
function dayStart(o){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+o);return d}
function times(day){
  const pt=new adhan.PrayerTimes(new adhan.Coordinates(loc.lat,loc.lon),day,params()),o={};
  PRAYERS.forEach(([k])=>{o[k]=new Date(pt[k].getTime()+(adj[k]||0)*6e4)});return o;
}
const fT=d=>d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
function fLeft(ms){const m=Math.max(0,Math.ceil(ms/6e4)),h=Math.floor(m/60),r=m%60;return h?`${h} Std. ${r} Min.`:`${r} Min.`}
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
  if(live){
    $("heroLabel").hidden=true;
    $("curName").textContent=LABEL[cur.k];
    $("qBtn").hidden=false;
    $("nextLine").innerHTML=`${LABEL[next.k]} in <b>${fLeft(next.t-now)}</b>`;
  }else{
    if(qActive)stopQibla();
    $("qBtn").hidden=true;
    $("heroLabel").hidden=false;$("heroLabel").textContent=dayOffset>0?"Vorschau":"Rückblick";
    $("curName").textContent=day.toLocaleDateString("de-DE",{weekday:"long"});
    $("nextLine").textContent=day.toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"});
  }
  renderArc(day,t,now,live);
  $("gregDate").textContent=day.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  $("hijriDate").textContent=hijriText(day);
  renderDays();
}


/* ================= Gebetsliste ================= */
// Ruhige Liste ohne Shuruq: vergangen grau, aktuell weiß, kommend hellgrau.
const ARC=["fajr","dhuhr","asr","maghrib","isha"];
// Sterne nur ab Isha (Nacht), im oberen Drittel, sehr dezent, nach unten ausgeblendet; fest verteilt, damit nichts springt
(()=>{let x=11,o="";const rnd=()=>(x=(x*16807)%2147483647)/2147483647;
  for(let i=0;i<26;i++){const r=rnd(),sz=r<.1?1.5:1;
    o+=`<i style="left:${(rnd()*100).toFixed(2)}%;top:${(rnd()*92).toFixed(2)}%;width:${sz}px;height:${sz}px;opacity:${(.22+rnd()*.38).toFixed(2)}"></i>`}
  $("nightSky").innerHTML=o})();
function renderArc(day,t,now,live){
  const tod=times(dayStart(0));
  // Himmel oben: Tag (Fajr–Maghrib), Abend (Maghrib–Isha), Nacht (Isha–Fajr)
  const ph=now>=tod.isha||now<tod.fajr?"night":now>=tod.maghrib?"dusk":"day";
  ["day","dusk","night"].forEach(p=>document.body.classList.toggle("ph-"+p,p===ph));
  // aktuelles und nächstes Gebet ohne Shuruq
  let cur=null,nxt=null;
  if(live){
    for(let i=ARC.length-1;i>=0;i--){if(now>=t[ARC[i]]){cur=ARC[i];break}}
    if(cur){const i=ARC.indexOf(cur);nxt=i<ARC.length-1?{k:ARC[i+1],t:t[ARC[i+1]]}:{k:null,t:times(dayStart(1)).fajr}}
    else nxt={k:"fajr",t:t.fajr};
  }
  const fri=day.getDay()===5;
  $("pts").innerHTML=ARC.map(k=>{
    const m=adj[k]||0,n=k==="dhuhr"&&fri?"Jumu'a":LABEL[k];
    let c="prow";
    if(live){
      if(k===cur)c+=" cur";
      else if(nxt&&k===nxt.k)c+=" upnext";
      else if(now>=t[k])c+=" past";
    }
    if(adjKey===k)c+=" sel";
    return `<button class="${c}" data-k="${k}" aria-label="${n} ${fT(t[k])}${m?`, angepasst um ${m>0?"plus":"minus"} ${Math.abs(m)} Minuten`:""}. Antippen zum Anpassen"><span class="pn">${n}</span><span class="pt-t">${m?`<em aria-hidden="true">•</em>`:""}${fT(t[k])}</span></button>`;
  }).join("");
}
$("pts").addEventListener("click",e=>{const b=e.target.closest("[data-k]");if(!b)return;adjKey=b.dataset.k;renderAdj();renderTimes();openSheet("adjSheet")});

/* ================= Andere Tage ================= */
// Die Startseite zeigt immer heute. Andere Tage öffnen sich über das Datum unten in einem Fenster mit eigenen Pfeilen,
// damit die Zeiten direkt neben den Pfeilen stehen. Startet mit morgen, dem häufigsten Fall.
let dvOff=1;
function renderDv(){
  const day=dayStart(dvOff),t=times(day),fri=day.getDay()===5;
  $("dvTitle").textContent=dvOff===0?"Heute":dvOff===1?"Morgen":dvOff===-1?"Gestern":day.toLocaleDateString("de-DE",{weekday:"long"});
  $("dvSub").innerHTML=`${esc(day.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short",year:"numeric"}))}<br>${esc(hijriText(day))}`;
  $("dvList").innerHTML=["fajr","sunrise","dhuhr","asr","maghrib","isha"].map(k=>`<div class="dv-row${k==="sunrise"?" sun":""}"><span>${k==="dhuhr"&&fri?"Jumu'a":LABEL[k]}</span><span>${fT(t[k])}</span></div>`).join("");
  $("dvToday").hidden=dvOff===0;
}
function dvGo(o){const dir=Math.sign(o-dvOff);dvOff=o;renderDv();if(dir)slideIn($("dvList"),dir,10,180)}
$("dateBtn").addEventListener("click",()=>{dvOff=1;renderDv();openSheet("dayvSheet")});
$("dvPrev").addEventListener("click",()=>dvGo(dvOff-1));
$("dvNext").addEventListener("click",()=>dvGo(dvOff+1));
$("dvToday").addEventListener("click",()=>dvGo(0));

/* ================= Islamische Tage ================= */
// kind: fest = Festtag, sunnah = empfohlenes Fasten/Ibada, zeit = besondere Zeit
function dayRules(h){
  const out=[];const {d,m}=h;
  if(m!==9&&(d===13||d===14||d===15)&&!(m===12&&d===13))out.push({k:"bid",title:"Weiße Tage",note:"Sunnah-Fasten am 13., 14. und 15.",kind:"sunnah"});
  if(m===1&&d===1)out.push({k:"newyear",title:"Islamisches Neujahr",note:`1. Muharram ${h.y}`,kind:"zeit"});
  if(m===1&&(d===9||d===10))out.push({k:"ashura",title:"Tasu'a & Ashura",note:"Fasten am 9. und 10. Muharram",kind:"sunnah"});
  if(m===9&&d===1)out.push({k:"ramadan",title:"Ramadan beginnt",note:"Erstes Tarawih am Vorabend",kind:"fest"});
  // Die erste der letzten zehn Nächte (21. Nacht) beginnt mit Maghrib am 20. Ramadan
  if(m===9&&d===20)out.push({k:"last10",title:"Letzte zehn Nächte",note:"Ab Maghrib · Laylat al-Qadr in den ungeraden Nächten suchen",kind:"zeit",eve:true});
  if(m===10&&d===1)out.push({k:"fitr",title:"Eid al-Fitr",note:"Zakat al-Fitr vor dem Festgebet",kind:"fest"});
  if(m===10&&d===2)out.push({k:"shawwal",title:"Sechs Tage Shawwal",note:"Sechs Fastentage im Shawwal",kind:"sunnah"});
  if(m===12&&d===1)out.push({k:"dhul10",title:"Erste zehn Tage Dhul-Hijja",note:"Die besten Tage des Jahres",kind:"zeit"});
  if(m===12&&d===9)out.push({k:"arafah",title:"Tag von Arafah",note:"Fasten für Nicht-Pilger empfohlen",kind:"sunnah"});
  if(m===12&&d===10)out.push({k:"adha",title:"Eid al-Adha",note:"Opferfest",kind:"fest"});
  if(m===12&&d>=11&&d<=13)out.push({k:"tashriq",title:"Tage von Tashriq",note:"An diesen Tagen wird nicht gefastet",kind:"zeit"});
  return out;
}
let evCache=null;
function events(){
  const key=`${dayStart(0).toDateString()}|${settings.hijri}`;
  if(evCache&&evCache.key===key)return evCache.list;
  const list=[];const open={};
  for(let i=-3;i<=385;i++){
    const d=dayStart(i),h=hParts(d);if(!h)break;
    const found=dayRules(h);const ks=new Set(found.map(f=>f.k));
    found.forEach(f=>{
      if(open[f.k]){open[f.k].end=d}
      else{const e=Object.assign({start:d,end:d,h},f);open[f.k]=e;list.push(e)}
    });
    Object.keys(open).forEach(k=>{if(!ks.has(k))delete open[k]});
  }
  const today=dayStart(0);
  const lim=dayStart(366);
  const res=list.filter(e=>e.end>=today&&e.start<=lim);
  evCache={key,list:res};return res;
}
const fD=d=>d.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"});
function fRange(e){
  if(+e.start===+e.end)return fD(e.start);
  const same=e.start.getMonth()===e.end.getMonth();
  return same?`${e.start.getDate()}.–${e.end.toLocaleDateString("de-DE",{day:"numeric",month:"short"})}`:`${e.start.toLocaleDateString("de-DE",{day:"numeric",month:"short"})} – ${e.end.toLocaleDateString("de-DE",{day:"numeric",month:"short"})}`;
}
function fWhen(e){
  const today=dayStart(0);
  if(e.start<=today&&e.end>=today)return"heute";
  const n=Math.round((e.start-today)/864e5);
  if(n===1)return"morgen";
  if(n<7)return`in ${n} Tagen`;
  if(n<60)return`in ${Math.round(n/7)} Wo.`;
  return`in ${Math.round(n/30.4)} Mon.`;
}
function evRow(e){
  const w=fWhen(e);
  return `<div class="item"><span class="ev"><b>${e.title}</b><span>${fRange(e)}<i class="nt"> · ${e.note}</i></span></span><span class="when${w==="heute"||w==="morgen"?" soon":""}">${w}</span></div>`;
}
function renderDays(){
  const list=events(),today=dayStart(0);
  // Hinweis „heute/morgen“ unter dem Countdown
  const now=list.find(e=>e.start<=today&&e.end>=today);
  const tom=list.find(e=>Math.round((e.start-today)/864e5)===1);
  const chip=$("todayChip");
  if(dayOffset===0&&(now||tom)){
    const e=now||tom,h=hParts(today);
    let txt=now?(e.k==="bid"?`Weißer Tag · ${h?h.d+". "+HMONTH[h.m-1]:""}`:e.eve?`${e.title} ab heute Abend`:e.title):`Morgen: ${e.title}`;
    chip.innerHTML=`<svg viewBox="0 0 24 24"><use href="#i-moon"/></svg><span>${txt}</span>`;chip.hidden=false;
  }else chip.hidden=true;
  const fut=list.filter(e=>e.start>today);
  const bid=fut.find(e=>e.k==="bid"),big=fut.filter(e=>e.k!=="bid").slice(0,bid?2:3);
  const up=(bid?[bid,...big]:big).sort((x,y)=>x.start-y.start);
  $("upcoming").innerHTML=up.length?up.map(evRow).join(""):`<p class="empty">Keine Termine gefunden.</p>`;
}
function openDays(){
  renderShift();$("daysList").innerHTML=events().map(evRow).join("");openSheet("daysSheet");
}
// Verschiebung aus Sicht der Feiertage: +1 = alles einen Tag später = Hijri-Datum einen Tag zurück
function renderShift(){
  const v=-settings.hijri;
  $("hijVal").textContent=v===0?"0 Tage":`${v>0?"+":"−"}${Math.abs(v)} ${Math.abs(v)===1?"Tag":"Tage"}`;
  $("hijMinus").disabled=v<=-2;$("hijPlus").disabled=v>=2;
}
function setShift(v){
  v=Math.max(-2,Math.min(2,v));settings.hijri=-v;store.set("hijri",settings.hijri);evCache=null;
  renderShift();$("daysList").innerHTML=events().map(evRow).join("");renderTimes();
}
$("hijMinus").addEventListener("click",()=>setShift(-settings.hijri-1));
$("hijPlus").addEventListener("click",()=>setShift(-settings.hijri+1));
$("allDays").addEventListener("click",openDays);
$("upcoming").addEventListener("click",openDays);
$("todayChip").addEventListener("click",openDays);
const icsEsc=t=>String(t).replace(/\\/g,"\\\\").replace(/([,;])/g,"\\$1");
$("icsBtn").addEventListener("click",()=>{
  const pad=n=>String(n).padStart(2,"0"),ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Falak//Islamische Tage//DE","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Islamische Tage"];
  events().forEach(e=>{const end=new Date(e.end);end.setDate(end.getDate()+1);
    lines.push("BEGIN:VEVENT",`UID:${e.k}-${e.h.y}-${e.h.m}@falak`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${ymd(e.start)}`,`DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${icsEsc(e.title)}`,`DESCRIPTION:${icsEsc(e.note)}`,"TRANSP:TRANSPARENT",
      "BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEsc(e.title)}`,"TRIGGER:-PT6H","END:VALARM","END:VEVENT")});
  lines.push("END:VCALENDAR");
  download("islamische-tage.ics",lines.join("\r\n"),"text/calendar");
  toast("Kalenderdatei erstellt");
});

/* ================= Minuten-Anpassung ================= */
// Berechnung ist fest (Weltliga, Asr Standard, Siebtel der Nacht). Jede Zeit lässt sich per Antippen um Minuten verschieben.
let adjKey=null;
function renderAdj(){
  const k=adjKey;if(!k)return;
  const m=adj[k]||0,t=times(dayStart(dayOffset)),fri=dayStart(dayOffset).getDay()===5;
  $("adjTitle").textContent=k==="dhuhr"&&fri?"Jumu'a":LABEL[k];
  $("adjTime").textContent=fT(t[k]);
  $("adjCalc").textContent=`Berechnet: ${fT(new Date(t[k]-m*6e4))}`;
  $("adjVal").textContent=m===0?"0 Min.":`${m>0?"+":"−"}${Math.abs(m)} Min.`;
  $("adjMinus").disabled=m<=-30;$("adjPlus").disabled=m>=30;
  $("adjHint").textContent=`Legt ${$("adjTitle").textContent} für 30 Tage mit Erinnerung im Kalender an. Nach einer Anpassung erneut übernehmen.`;
}
function setAdj(k,m){m=Math.max(-30,Math.min(30,m));if(m)adj[k]=m;else delete adj[k];store.set("adj",adj);renderAdj();renderTimes()}
$("adjMinus").addEventListener("click",()=>setAdj(adjKey,(adj[adjKey]||0)-1));
$("adjPlus").addEventListener("click",()=>setAdj(adjKey,(adj[adjKey]||0)+1));
// Erinnerung über den iPhone-Kalender: Eine Web-App wird im Hintergrund angehalten und kann nicht zuverlässig benachrichtigen.
function download(name,text,type){
  const blob=new Blob([text],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
}
const icsUTC=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z");
$("adjCal").addEventListener("click",()=>{
  const k=adjKey;if(!k)return;
  const stamp=icsUTC(new Date()),pad=n=>String(n).padStart(2,"0");
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Falak//Gebetszeiten//DE","CALSCALE:GREGORIAN","METHOD:PUBLISH",`X-WR-CALNAME:Falak · ${LABEL[k]}`];
  for(let i=0;i<30;i++){
    const day=dayStart(i),t=times(day)[k],name=k==="dhuhr"&&day.getDay()===5?"Jumu'a":LABEL[k];
    const end=new Date(t.getTime()+15*6e4),id=`${day.getFullYear()}${pad(day.getMonth()+1)}${pad(day.getDate())}`;
    lines.push("BEGIN:VEVENT",`UID:${k}-${id}@falak`,`DTSTAMP:${stamp}`,`DTSTART:${icsUTC(t)}`,`DTEND:${icsUTC(end)}`,
      `SUMMARY:${icsEsc(name)}`,`LOCATION:${icsEsc(loc.name)}`,"TRANSP:TRANSPARENT",
      "BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEsc("Zeit für "+name)}`,"TRIGGER:PT0M","END:VALARM","END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  download(`falak-${k}.ics`,lines.join("\r\n"),"text/calendar");
  toast("Kalenderdatei erstellt");
});
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
function setLoc(l){loc=l;store.set("loc",l);closeSheet();renderTimes();updateQiblaTarget();toast(`Ort: ${l.name}`)}
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
// „Qibla“ in der Kapsel startet den Kompass: Der Pfeil zeigt zur Kaaba, der Text sagt, wohin drehen;
// ausgerichtet wird er grün. Nochmal tippen beendet.
const MECCA={lat:21.4225,lon:39.8262};
let qTarget=0,qDecl=0,tilted=false,qActive=false,listening=false,lastEvt=0,sx=null,sy=null,raf=0,wasAligned=false,shown=null,warnedAcc=false;
function compassName(d){return["Nord","Nordost","Ost","Südost","Süd","Südwest","West","Nordwest"][Math.round(d/45)%8]}
// Kompass liefert magnetisch Nord (Apple-Doku zu webkitCompassHeading); die Kaaba-Richtung ist geografisch.
// Missweisung nach dem Weltmagnetfeldmodell WMM 2025 (Bremen 2026: rund 4° Ost) wird deshalb aufaddiert.
function updateQiblaTarget(){
  qTarget=adhan.Qibla(new adhan.Coordinates(loc.lat,loc.lon));
  try{qDecl=typeof magvar==="function"?+magvar(loc.lat,loc.lon)||0:0}catch(e){qDecl=0}
}
function onOrient(e){
  if(!qActive)return;
  let h=null;
  if(typeof e.webkitCompassHeading==="number"&&!isNaN(e.webkitCompassHeading))h=e.webkitCompassHeading;
  else if(e.absolute&&e.alpha!=null)h=360-e.alpha;
  if(h==null)return;
  h+=qDecl;
  // Kompass misst nur flach gehalten sauber
  if(e.beta!=null&&e.gamma!=null)tilted=Math.abs(e.beta)>40||Math.abs(e.gamma)>40;
  const so=(screen.orientation&&screen.orientation.angle)||window.orientation||0;h=(h+so+360)%360;
  lastEvt=Date.now();
  const x=Math.cos(h*R),y=Math.sin(h*R);
  if(sx==null){sx=x;sy=y}else{sx=sx*.82+x*.18;sy=sy*.82+y*.18}
  if(typeof e.webkitCompassAccuracy==="number"&&!warnedAcc&&(e.webkitCompassAccuracy<0||e.webkitCompassAccuracy>25)){
    warnedAcc=true;toast("Kompass ungenau: iPhone ein paar Mal in Form einer Acht bewegen");
  }
  if(!raf)raf=requestAnimationFrame(drawHeading);
}
function drawHeading(){
  raf=0;if(!qActive)return;
  const h=(Math.atan2(sy,sx)/R+360)%360;
  if(shown==null)shown=h;else{let d=((h-shown+540)%360)-180;shown+=d}
  $("qRot").style.transform=`rotate(${(qTarget-shown).toFixed(1)}deg)`;
  const diff=((qTarget-h+540)%360)-180,ad=Math.abs(diff),ok=!tilted&&ad<=3;
  $("qBtn").classList.toggle("ok",ok);
  $("qLbl").textContent=tilted?"Handy flach halten":ok?"Richtung stimmt":`${Math.round(ad)}° nach ${diff>0?"rechts":"links"} drehen`;
  if(ok&&!wasAligned&&navigator.vibrate)navigator.vibrate(18);
  wasAligned=ok;
}
function stopQibla(){
  if(!qActive)return;
  qActive=false;shown=null;sx=sy=null;wasAligned=false;tilted=false;
  const b=$("qBtn");b.classList.remove("on","ok");b.setAttribute("aria-pressed","false");b.closest(".hrow").classList.remove("qon");
  $("qRot").style.transform="";$("qLbl").textContent="Qibla";
}
async function startQibla(){
  try{
    if(typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function"){
      const r=await DeviceOrientationEvent.requestPermission();
      if(r!=="granted"){toast("Kompasszugriff abgelehnt. App ganz schließen und neu öffnen");return}
    }
  }catch(e){toast("Der Kompass konnte nicht gestartet werden");return}
  if(!listening){
    listening=true;
    if("ondeviceorientationabsolute" in window)window.addEventListener("deviceorientationabsolute",onOrient);
    window.addEventListener("deviceorientation",onOrient);
  }
  if(dayOffset!==0){dayOffset=0}
  updateQiblaTarget();
  qActive=true;lastEvt=0;warnedAcc=false;
  const b=$("qBtn");b.classList.add("on");b.setAttribute("aria-pressed","true");b.closest(".hrow").classList.add("qon");
  renderTimes();
  $("qLbl").textContent=`Qibla ${Math.round(qTarget)}° · ${compassName(qTarget)}`;
  setTimeout(()=>{if(qActive&&!lastEvt){stopQibla();toast(`Kein Kompass gefunden. Qibla: ${Math.round(qTarget)}° (${compassName(qTarget)})`)}},2500);
}
$("qBtn").addEventListener("click",()=>{qActive?stopQibla():startQibla()});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopQibla()});

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

/* ================= Dhikr ================= */
// Tasbih nach dem Pflichtgebet (Sahih Muslim): 33 × SubhanAllah, 33 × Alhamdulillah, 33 × Allahu Akbar, dann einmal Tahlil = 100.
// Der Stand bleibt beim Verlassen erhalten und beginnt am nächsten Tag von vorn.
const DZ=[
 {ar:"سُبْحَانَ ٱللَّٰهِ",tr:"SubhanAllah",de:"Gepriesen sei Allah",n:33},
 {ar:"ٱلْحَمْدُ لِلَّٰهِ",tr:"Alhamdulillah",de:"Alles Lob gebührt Allah",n:33},
 {ar:"ٱللَّٰهُ أَكْبَرُ",tr:"Allahu Akbar",de:"Allah ist größer",n:33},
 {ar:"لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ ٱلْمُلْكُ وَلَهُ ٱلْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ",tr:"La ilaha illallahu wahdahu la scharika lah, lahul-mulku wa lahul-hamd, wa huwa ala kulli schay'in qadir",de:"Es gibt keinen Gott außer Allah allein, ohne Partner. Ihm gehört die Herrschaft und das Lob, und Er hat Macht über alle Dinge.",n:1}];
const dzDay=()=>dayStart(0).toDateString();
let dz=(()=>{const s=store.get("dhikr",null);return s&&s.d===dzDay()?s:{d:dzDay(),i:0,c:0}})();
function saveDz(){dz.d=dzDay();store.set("dhikr",dz)}
function renderDz(){
  if(dz.d!==dzDay())dz={d:dzDay(),i:0,c:0};
  const done=dz.i>=DZ.length,d=DZ[Math.min(dz.i,DZ.length-1)];
  $("dzStep").textContent=done?"Fertig · 100 von 100":`${dz.i+1} von 4 · nach dem Gebet`;
  $("dzAr").textContent=done?"تَقَبَّلَ ٱللَّٰهُ":d.ar;$("dzTr").textContent=done?"Taqabbal Allah":d.tr;$("dzDe").textContent=done?"Möge Allah es annehmen":d.de;
  $("dzN").textContent=done?"✓":dz.c;$("dzOf").textContent=done?"":`von ${d.n}`;
  $("dzAr").classList.toggle("long",!done&&d.ar.length>40);
  $("dzHint").textContent=done?"Oben rechts von vorn beginnen":"Irgendwo tippen zum Zählen";
  [...$("dzBars").children].forEach((b,k)=>b.style.setProperty("--p",k<dz.i?1:k===dz.i?dz.c/DZ[k].n:0));
}
$("dhikrTap").addEventListener("click",()=>{
  if(dz.i>=DZ.length)return;
  dz.c++;if(dz.c>=DZ[dz.i].n){dz.i++;dz.c=0;if(navigator.vibrate)navigator.vibrate(30);slideIn($("dzAr"),1,8,180)}
  saveDz();renderDz();
});
$("dhikrReset").addEventListener("click",()=>{dz={d:dzDay(),i:0,c:0};saveDz();renderDz()});
$("dhikrBtn").addEventListener("click",()=>{history.pushState({v:"dhikr"},"");setView("dhikr")});
$("dhikrBack").addEventListener("click",()=>{if(history.state&&history.state.v==="dhikr")history.back();else setView("times")});

/* ================= Hadith des Tages ================= */
const HAPI=["https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions","https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions"];
// min: Muslim beginnt mit einer Einleitung (1–92) ohne Hadith-Texte
const HCOL=[{k:"bukhari",name:"Sahih al-Bukhari",min:1,max:7000},{k:"muslim",name:"Sahih Muslim",min:93,max:7000},{k:"nawawi",name:"40 Hadith an-Nawawi",min:1,max:42}];
function dayIndex(){const d=new Date();return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()))/864e5)}
function hash(n){n=(n^61)^(n>>>16);n=n+(n<<3);n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return n>>>0}
const usable=t=>t&&t.length>=80&&t.length<=1100&&/(Prophet|Messenger|Apostle|Allah)/.test(t);
async function hjson(path){
  for(const base of HAPI){
    const ac=new AbortController(),to=setTimeout(()=>ac.abort(),7000);
    try{const r=await fetch(`${base}/${path}`,{signal:ac.signal});if(r.ok)return await r.json()}catch(e){}
    finally{clearTimeout(to)}
  }
  return null;
}
async function getHadith(col,num){
  const en=await hjson(`eng-${col.k}/${num}.json`),e=en&&en.hadiths&&en.hadiths[0];
  if(!e||!usable(e.text))return null;
  const ar=await hjson(`ara-${col.k}/${num}.json`),a=ar&&ar.hadiths&&ar.hadiths[0];
  return{src:`${col.name} ${e.hadithnumber}`,en:e.text.trim(),ar:a&&a.text?a.text.trim():""};
}
async function loadHadith(){
  const day=dayIndex(),cached=store.get("hadith",null);
  if(cached&&cached.day===day)return showHadith(cached);
  const col=HCOL[day%HCOL.length],span=col.max-col.min+1,start=hash(day)%span;let h=null;
  // in Sprüngen suchen, damit leere Abschnitte übersprungen werden
  for(let i=0;i<10&&!h;i++)h=await getHadith(col,col.min+(start+i*173)%span);
  if(!h){const n=HCOL[2];for(let i=0;i<5&&!h;i++)h=await getHadith(n,n.min+(day+i)%n.max)}
  if(h){h.day=day;store.set("hadith",h);showHadith(h)}
  else if(cached)showHadith(cached);
  else{$("hEn").textContent=navigator.onLine?"Hadith konnte gerade nicht geladen werden. Versuch es später noch mal.":"Gerade keine Verbindung. Der Hadith erscheint, sobald du online bist."}
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

/* ================= Start ================= */
const onScroll=()=>document.body.classList.toggle("scrolled",window.scrollY>4);
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
document.body.classList.add("on-times");
if(history.state&&history.state.v)history.replaceState(null,"");
renderTimes();
loadHadith();
setInterval(()=>{if(view==="times"&&!document.hidden)renderTimes()},15000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&view==="times")renderTimes()});
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
