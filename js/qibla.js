// Falak – Qibla-Kompass
"use strict";

/* ================= Qibla ================= */
// Die Nadel oben rechts startet den Kompass: Die Zeile „Asr in 1 Std.“ wird zum Hinweistext („23° nach rechts drehen“), die Nadel
// zeigt zur Kaaba; ausgerichtet wird beides grün. Nadel oder Text antippen beendet. In Ruhe zeigt die Nadel die Richtung von Norden aus.
let qTarget=0,qDecl=0,tilted=false,qActive=false,listening=false,lastEvt=0,sx=null,sy=null,raf=0,wasAligned=false,shown=null,lastRot="";
function compassName(d){return["Nord","Nordost","Ost","Südost","Süd","Südwest","West","Nordwest"][Math.round(d/45)%8]}
// Kompass liefert magnetisch Nord (Apple-Doku zu webkitCompassHeading); die Kaaba-Richtung ist geografisch.
// Missweisung nach dem Weltmagnetfeldmodell WMM 2025 (Bremen 2026: rund 4° Ost) wird deshalb aufaddiert.
function updateQiblaTarget(){
  qTarget=adhan.Qibla(new adhan.Coordinates(loc.lat,loc.lon));
  try{qDecl=typeof magvar==="function"?+magvar(loc.lat,loc.lon)||0:0}catch(e){qDecl=0}
  if(!qActive)qRest();
}
// Ruhezustand: feste Nadel oben rechts
function qRest(){lastRot=`rotate(${qTarget.toFixed(1)}deg)`;$("qGoArrow").style.transform=lastRot;
  setText($("qLbl"),`Qibla ${Math.round(qTarget)}°`)}
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
  if(!raf)raf=requestAnimationFrame(drawHeading);
}
function drawHeading(){
  raf=0;if(!qActive)return;
  const h=(Math.atan2(sy,sx)/R+360)%360;
  if(shown==null)shown=h;else{let d=((h-shown+540)%360)-180;shown+=d}
  const rot=`rotate(${(qTarget-shown).toFixed(1)}deg)`;if(rot!==lastRot){lastRot=rot;$("qGoArrow").style.transform=rot}
  const diff=((qTarget-h+540)%360)-180,ad=Math.abs(diff),ok=!tilted&&ad<=3;
  $("qBtn").classList.toggle("ok",ok);$("hero").classList.toggle("qok",ok);
  setText($("qLbl"),tilted?"Handy flach halten":ok?"Richtung stimmt":`nach ${diff>0?"rechts":"links"} drehen`);
  {const bt=tilted?"Flach":ok?"Qibla":`${Math.round(ad)}°`;if($("qBig").textContent!==bt){$("qBig").textContent=bt;placeNeedle()}}
  if(ok&&!wasAligned&&navigator.vibrate)navigator.vibrate(18);
  wasAligned=ok;
}
// Kurze Rückmeldung direkt in der Zeile statt einer Meldung am Bildschirmrand; nach 4 s steht wieder der Countdown
let qFlashT=0,qStartT=0;
function qFlash(t){const b=$("qBtn");$("qLbl").textContent=t;b.classList.add("flash");$("hero").classList.add("qon");clearTimeout(qFlashT);
  qFlashT=setTimeout(()=>{if(!qActive){b.classList.remove("flash");$("hero").classList.remove("qon");qRest()}},4000)}
function stopQibla(){
  if(!qActive)return;
  qActive=false;clearTimeout(qStartT);shown=null;sx=sy=null;wasAligned=false;tilted=false;
  const b=$("qBtn");b.classList.remove("on","ok","flash");b.setAttribute("aria-pressed","false");$("hero").classList.remove("qon","qok","qlive");placeNeedle();$("qGo").setAttribute("aria-pressed","false");$("qGo").setAttribute("aria-label","Qibla-Kompass starten");
  qRest();
}
async function startQibla(){
  try{
    if(typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function"){
      const r=await DeviceOrientationEvent.requestPermission();
      if(r!=="granted"){qFlash("Kompass nicht erlaubt");return}
    }
  }catch(e){qFlash("Kompass startet nicht");return}
  if(!listening){
    listening=true;
    if("ondeviceorientationabsolute" in window)window.addEventListener("deviceorientationabsolute",onOrient);
    window.addEventListener("deviceorientation",onOrient);
  }
  if(dayOffset!==0){dayOffset=0}
  updateQiblaTarget();
  qActive=true;lastEvt=0;
  const b=$("qBtn");b.classList.remove("flash");b.classList.add("on");b.setAttribute("aria-pressed","true");$("hero").classList.add("qon","qlive");$("qBig").textContent="Qibla";placeNeedle();$("qGo").setAttribute("aria-pressed","true");$("qGo").setAttribute("aria-label","Qibla-Kompass beenden");
  renderTimes();
  $("qLbl").textContent=`Qibla ${Math.round(qTarget)}° · ${compassName(qTarget)}`;
  clearTimeout(qStartT);qStartT=setTimeout(()=>{if(qActive&&!lastEvt){stopQibla();qFlash(`Qibla ${Math.round(qTarget)}° · ${compassName(qTarget)}`)}},2500);
}
$("qBtn").addEventListener("click",()=>{qActive?stopQibla():startQibla()});
$("qBig").addEventListener("click",()=>{if(qActive)stopQibla()});
// Die Nadel startet und beendet den Kompass (iOS verlangt für den Start eine Berührung)
$("qGo").addEventListener("click",()=>{if(qActive){stopQibla();return}store.set("qUsed",true);$("qGo").classList.remove("hint");startQibla()});
// Nadel-Hinweis: dreimal beim Öffnen (und nach längerer Pause), bis Qibla einmal benutzt wurde
function qHint(){const g=$("qGo");if(store.get("qUsed",false))return;g.classList.remove("hint");void g.offsetWidth;g.classList.add("hint")}
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopQibla()});

// Nadel hinter den Gebetsnamen setzen: waagrecht 5 px hinter dem sichtbaren Titel (sichtbarer Abstand der Nadel ca. 10 px), senkrecht auf halber Höhe der Großbuchstaben.
// Auf Vorschau- und Rückblick-Tagen (Wochentag als Titel) entfällt sie.
const needleC=document.createElement("canvas").getContext("2d"),needleM=new Map();
function placeNeedle(){
  const g=$("qGo"),h=$("hero");
  g.hidden=dayOffset!==0;if(g.hidden)return;
  const t=h.classList.contains("qlive")?$("qBig"):$("curName"),box=$("curName").getBoundingClientRect(),hr=h.getBoundingClientRect();
  const rg=document.createRange();rg.selectNodeContents(t);const tr=rg.getBoundingClientRect();
  if(!tr.width||!box.height)return;
  const cs=getComputedStyle($("curName")),font=`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  // Schriftmaße der Hauptzeile nur neu messen, wenn sich die Schrift ändert (Canvas einmal anlegen)
  let m=needleM.get(font);
  if(!m){needleC.font=font;const q=needleC.measureText("H");m={fa:q.fontBoundingBoxAscent,fd:q.fontBoundingBoxDescent,aa:q.actualBoundingBoxAscent};needleM.set(font,m)}
  const base=box.top+(box.height-(m.fa+m.fd))/2+m.fa,mid=base-m.aa/2;
  g.style.left=(tr.right-hr.left+5+10-22).toFixed(1)+"px";g.style.top=(mid-hr.top-22).toFixed(1)+"px";
  if(!g.classList.contains("placed"))requestAnimationFrame(()=>g.classList.add("placed"));
}
window.addEventListener("resize",placeNeedle);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(placeNeedle);
