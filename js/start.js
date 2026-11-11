// Falak – Start (muss als letzte Datei geladen werden)
"use strict";

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
