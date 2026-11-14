// Site-wide public announcements and UI-only maintenance/feature notices.
// Never treat these flags as authentication or security enforcement.
import {collection,doc,limit,onSnapshot,orderBy,query} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {firebaseClient} from "./community-data.js";

const header=document.querySelector("header");
let settings={},announcements=[];
const notice=document.createElement("div");
notice.className="site-notice-stack";
notice.setAttribute("aria-live","polite");
if(header)header.insertAdjacentElement("afterend",notice);
function alertRow(title,details,kind){
 const row=document.createElement("div");row.className="site-notice "+kind;
 const strong=document.createElement("strong");strong.textContent=title;
 const span=document.createElement("span");span.textContent=details;
 row.append(strong,span);
 return row;
}
function render(){
 notice.replaceChildren();
 if(settings.maintenance)notice.append(alertRow("Maintenance",settings.message||"The website is being updated.","maintenance"));
 const active=announcements.filter(a=>a.active);
 if(active.length)notice.append(alertRow(active[0].title,active[0].body,"announcement"));
 const features=settings.features||{};
 const ids={social:"messages.html",tasks:"tasks.html",calendar:"calendar.html"};
 for(const [feature,file] of Object.entries(ids)){
  document.querySelectorAll('a[href="'+file+'"]').forEach(link=>{
   const hidden=features[feature]===false;
   link.hidden=hidden;
   link.setAttribute("aria-hidden",hidden?"true":"false");
  });
 }
}
try{
 const c=firebaseClient();
 onSnapshot(doc(c.db,"siteConfig","main"),snap=>{
  settings=snap.exists()?snap.data():{};render();
 },e=>console.info("Site preferences unavailable until rules are published.",e.code||e));
 onSnapshot(query(collection(c.db,"siteAnnouncements"),orderBy("createdAt","desc"),limit(20)),snap=>{
  announcements=snap.docs.map(s=>s.data());render();
 },e=>console.info("Public announcements unavailable until rules are published.",e.code||e));
}catch(e){console.warn("Site notices unavailable.",e);}
