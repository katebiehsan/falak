// Falak – Hadith des Tages
"use strict";

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
