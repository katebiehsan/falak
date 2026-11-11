// Falak – Qibla-Kompass
"use strict";

/* ================= Qibla ================= */
// „Qibla“ in der Kapsel startet den Kompass: Der Pfeil zeigt zur Kaaba, der Text sagt, wohin drehen;
// ausgerichtet wird er grün. Nochmal tippen beendet.
const MECCA={lat:21.4225,lon:39.8262};
let qTarget=0,qDecl=0,tilted=false,qActive=false,listening=false,lastEvt=0,sx=null,sy=null,raf=0,wasAligned=false,shown=null;
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
// Kurze Rückmeldung direkt in der Kapsel statt einer Meldung am Bildschirmrand; nach 4 s steht wieder „Qibla“
let qFlashT=0;
function qFlash(t){$("qLbl").textContent=t;clearTimeout(qFlashT);qFlashT=setTimeout(()=>{if(!qActive)$("qLbl").textContent="Qibla"},4000)}
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
  const b=$("qBtn");b.classList.add("on");b.setAttribute("aria-pressed","true");b.closest(".hrow").classList.add("qon");
  renderTimes();
  $("qLbl").textContent=`Qibla ${Math.round(qTarget)}° · ${compassName(qTarget)}`;
  setTimeout(()=>{if(qActive&&!lastEvt){stopQibla();qFlash(`Qibla ${Math.round(qTarget)}° · ${compassName(qTarget)}`)}},2500);
}
$("qBtn").addEventListener("click",()=>{qActive?stopQibla():startQibla()});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopQibla()});
