// Falak – Startseite: Hijri, Gebetszeiten, Gebetsliste, andere Tage, islamische Tage, Minuten-Anpassung, Ort
"use strict";

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
// Kurzform passend zum gekürzten deutschen Datum in der Fußzeile („Okt.“ ↔ „Jum. I“)
const HMONTH_S=["Muh.","Saf.","Rab. I","Rab. II","Jum. I","Jum. II","Raj.","Sha.","Ram.","Shaw.","Dhul-Q.","Dhul-H."];
function hijriShort(date){const h=hParts(date);return h?`${h.d}. ${HMONTH_S[h.m-1]} ${h.y}`:""}

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

    $("nextLine").innerHTML=`${LABEL[next.k]} in <b>${fLeft(next.t-now)}</b>`;
  }else{
    if(qActive)stopQibla();
    $("heroLabel").hidden=false;$("heroLabel").innerHTML=`${dayOffset>0?"Vorschau":"Rückblick"} · <button class="hl-today" id="heroToday">Heute ›</button>`;
    $("curName").textContent=day.toLocaleDateString("de-DE",{weekday:"long"});
    $("nextLine").textContent=day.toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"});
  }
  renderArc(day,t,now,live);
  $("gregDate").textContent=day.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  $("hijriDate").textContent=hijriShort(day);
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
  updTint();
  // aktuelles und nächstes Gebet ohne Shuruq
  let cur=null,nxt=null;
  if(live){
    for(let i=ARC.length-1;i>=0;i--){if(now>=t[ARC[i]]){cur=ARC[i];break}}
    if(cur){const i=ARC.indexOf(cur);nxt=i<ARC.length-1?{k:ARC[i+1],t:t[ARC[i+1]]}:{k:null,t:times(dayStart(1)).fajr}}
    else nxt={k:"fajr",t:t.fajr};
  }
  // Weiß ist immer das Gebet, dessen Zeit gerade läuft: vor Fajr noch Isha der Nacht; nach Shuruq ist Fajr vorbei
  let curRow=cur;
  if(live&&!cur)curRow="isha";
  else if(cur==="fajr"&&now>=t.sunrise)curRow=null;
  const fri=day.getDay()===5;
  $("pts").innerHTML=ARC.map(k=>{
    const m=adj[k]||0,n=k==="dhuhr"&&fri?"Jumu'a":LABEL[k];
    let c="prow";
    if(live){
      if(k===curRow)c+=" cur";
      else if(nxt&&k===nxt.k)c+=" upnext";
      else if(now>=t[k])c+=" past";
    }
    if(adjKey===k)c+=" sel";
    return `<button class="${c}" data-k="${k}" aria-label="${n} ${fT(t[k])}${m?`, angepasst um ${m>0?"plus":"minus"} ${Math.abs(m)} Minuten`:""}. Antippen zum Anpassen"><span class="pn">${n}</span><span class="pt-t">${m?`<em aria-hidden="true">•</em>`:""}${fT(t[k])}</span></button>`;
  }).join("");
}
$("pts").addEventListener("click",e=>{const b=e.target.closest("[data-k]");if(!b)return;adjKey=b.dataset.k;renderAdj();renderTimes();openSheet("adjSheet")});

/* ================= Andere Tage ================= */
// Über Startseite und Gebetszeiten nach links wischen = nächster Tag, nach rechts = vorheriger Tag (wie Kalender und Wetter).
// Abseits von heute erscheint „Heute“ in der Kapsel. Nach längerer Pause öffnet Falak wieder mit heute.
function goDay(o){const dir=Math.sign(o-dayOffset);if(!dir)return;if(qActive)stopQibla();dayOffset=o;renderTimes();
  ["curName","nextLine","pts"].forEach(id=>slideIn($(id),dir,10,180))}
// „Heute ›“ steht neben „Vorschau“ bzw. „Rückblick“; die Kapsel bleibt beim Wischen unverändert
$("heroLabel").addEventListener("click",e=>{if(e.target.closest("#heroToday"))goDay(0)});
(()=>{let x0=null,y0=0,t0=0;const v=$("v-times");
  v.addEventListener("touchstart",e=>{if(e.touches.length!==1||view!=="times"||openSheetEl){x0=null;return}
    const t=e.touches[0];if(t.clientX<24||t.clientX>innerWidth-24){x0=null;return} // Bildschirmrand gehört iOS (Zurück-Geste)
    x0=t.clientX;y0=t.clientY;t0=Date.now()},{passive:true});
  v.addEventListener("touchend",e=>{if(x0==null)return;const t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.6&&Date.now()-t0<700)goDay(dayOffset+(dx<0?1:-1))},{passive:true});
})();
let hiddenAt=0;
document.addEventListener("visibilitychange",()=>{if(document.hidden){hiddenAt=Date.now();return}
  if(dayOffset!==0&&Date.now()-hiddenAt>5*6e4){dayOffset=0;renderTimes()}});

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
