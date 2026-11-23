// Falak – Start (muss als letzte Datei geladen werden)
"use strict";

/* ================= Start ================= */
const onScroll=()=>{document.body.classList.toggle("scrolled",window.scrollY>4);updTint()};
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
