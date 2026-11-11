// Falak – Dhikr (Tasbih nach dem Gebet)
"use strict";

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
