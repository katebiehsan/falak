// Falak – Start (muss als letzte Datei geladen werden)
"use strict";

/* ================= Start ================= */
// Der Seitenkopf-Zustand („scrolled“) und damit die Notch-Farbe ändern sich nur an der 4-px-Schwelle: dazwischen kein Stil-Abgleich pro Scroll-Ereignis
let scrolledNow=null;
const onScroll=()=>{const s=window.scrollY>4;if(s===scrolledNow)return;scrolledNow=s;document.body.classList.toggle("scrolled",s);updTint()};
window.addEventListener("scroll",onScroll,{passive:true});onScroll();
document.body.classList.add("on-times");
if(history.state&&history.state.v)history.replaceState(null,"");
updateQiblaTarget();
renderTimes();
loadHadith();
setTimeout(checkMoved,1500);
qHint();
setInterval(()=>{if(view==="times"&&!document.hidden)renderTimes()},15000);
let awayAt=0;
document.addEventListener("visibilitychange",()=>{if(document.hidden){awayAt=Date.now();return}
  if(view==="times"){renderTimes();checkMoved();if(Date.now()-awayAt>5*6e4)qHint()}});
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
