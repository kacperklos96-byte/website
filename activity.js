import {
  collection, getDocs, limit, orderBy, query
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { authenticated, firebaseClient, recordActivity, when } from "./community-data.js";

const $ = id=>document.getElementById(id);
const list=$("activity-events");
let db,uid;
const labels={
  session_opened:["↗","Session opened"],
  profile_updated:["✎","Profile updated"],
  theme_changed:["◐","Appearance changed"],
  password_changed:["♢","Password changed"],
  message_sent:["✉","Message sent"],
  message_read:["✓","Message opened"]
};
function state(message,error=false){
  list.replaceChildren();
  const p=document.createElement("p");p.className="community-blank"+(error?" error":"");
  p.textContent=message;list.append(p);
}
async function loadEvents(){
  if(!uid)return;
  state("Loading recent activity…");
  try{
    const q=query(collection(db,"activity",uid,"events"),orderBy("createdAt","desc"),limit(50));
    const snapshot=await getDocs(q);
    list.replaceChildren();
    if(snapshot.empty){state("No activity recorded yet. Editing your profile or sending a message will add an entry.");return;}
    snapshot.forEach(s=>{
      const d=s.data();
      const [icon,label]=labels[d.kind]||["•","Account event"];
      const row=document.createElement("div");row.className="activity-row";
      const glyph=document.createElement("span");glyph.className="activity-glyph";glyph.textContent=icon;
      const text=document.createElement("div");text.className="member-text";
      const title=document.createElement("p");title.className="member-title";title.textContent=label;
      const details=document.createElement("p");details.className="member-description";
      details.textContent=String(d.details||"");
      const date=document.createElement("span");date.className="date";date.textContent=when(d.createdAt);
      text.append(title,details,date);row.append(glyph,text);list.append(row);
    });
  }catch(error){
    state(error.code==="permission-denied"
      ? "Your activity page requires the new Firestore rules. Publish them in Firebase Console."
      : "Couldn't load activity records right now.",true);
    console.error(error);
  }
}
$("refresh-activity").addEventListener("click",loadEvents);
try{
  const client=firebaseClient();db=client.db;
  authenticated(client.auth,async u=>{uid=u.uid;await loadEvents();});
}catch(error){state(error.message,true);}
