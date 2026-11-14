import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAt, endAt
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseClient, routeProfile, safeUid } from "./community-data.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const input = document.getElementById("user-search");
const results = document.getElementById("search-results");
const count = document.getElementById("result-count");
let db, user = null, timer = null, serial = 0;

function message(text) {
  results.replaceChildren();
  const p = document.createElement("p");
  p.className = "community-blank";
  p.textContent = text;
  results.appendChild(p);
}
function buttonLink(label, href, primary = false) {
  const a = document.createElement("a");
  a.className = "community-button" + (primary ? " primary" : "");
  a.href = href;
  a.textContent = label;
  a.style.textDecoration = "none";
  return a;
}
async function searchMembers() {
  if (!db) return;
  const mySearch = ++serial;
  const prefix = input.value.trim().toLowerCase().replace(/^@/, "");
  if (prefix && !/^[a-z0-9_]{1,20}$/.test(prefix)) {
    message("Search with letters, numbers, and underscores.");
    count.textContent = "0 results";
    return;
  }
  message("Searching public profiles…");
  try {
    const base = collection(db,"publicProfiles");
    const q = prefix
      ? query(base,orderBy("username"),startAt(prefix),endAt(prefix + "\uf8ff"),limit(15))
      : query(base,orderBy("username"),limit(12));
    const snap = await getDocs(q);
    if (mySearch !== serial) return;
    results.replaceChildren();
    count.textContent = snap.size + (snap.size === 1 ? " profile" : " profiles");
    if (snap.empty) { message("No public profiles found. Try another username."); return; }
    snap.docs.forEach(s => {
      const profile = s.data();
      if (!safeUid(s.id)) return;
      const row = document.createElement("div"); row.className = "member-row";
      const avatar = document.createElement("div"); avatar.className = "community-avatar";
      renderAvatar(avatar,profile);
      const text = document.createElement("div");text.className="member-text";
      const name=document.createElement("p");name.className="member-title";name.textContent=profile.displayName || "Member";
      const handle=document.createElement("span");handle.className="member-handle";handle.textContent="@"+profile.username;
      const bio=document.createElement("p");bio.className="member-description";bio.textContent=profile.bio || "No bio yet.";
      text.append(name,handle,bio);
      const actions=document.createElement("div");actions.className="member-actions";
      actions.appendChild(buttonLink("View",routeProfile(s.id)));
      if (user?.uid !== s.id) {
        actions.appendChild(buttonLink("Message",user?"messages.html?to="+encodeURIComponent(s.id):"login.html",true));
        if(user){
          const addFriend=document.createElement("button");
          addFriend.type="button";addFriend.className="community-button";addFriend.textContent="Add friend";
          addFriend.addEventListener("click",async()=>{
            addFriend.disabled=true;addFriend.textContent="Sending…";
            try{
              await setDoc(doc(db,"friendRequests",user.uid+"_"+s.id),{
                fromUid:user.uid,toUid:s.id,status:"pending",
                createdAt:serverTimestamp(),updatedAt:serverTimestamp()
              });
              addFriend.textContent="Request sent";
            }catch(error){
              console.error(error);
              addFriend.textContent=error.code==="permission-denied"?"Already requested / unavailable":"Failed — retry";
              addFriend.disabled=false;
            }
          });actions.append(addFriend);
        }
      }
      row.append(avatar,text,actions);results.appendChild(row);
    });
  } catch(error) {
    if(mySearch!==serial)return;
    console.error("Search failed:",error);
    count.textContent="Unavailable";
    message(error.code==="permission-denied"
      ? "Search requires the updated Firestore rules. Publish firestore.rules in Firebase Console."
      : "Search is unavailable right now. Please try again.");
  }
}
document.getElementById("clear-search").addEventListener("click",()=>{input.value="";searchMembers();input.focus();});
input.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(searchMembers,280);});
try {
  const client=firebaseClient(); db=client.db;
  onAuthStateChanged(client.auth,u=>{user=u;searchMembers();});
  searchMembers();
} catch(error) {count.textContent="Unavailable";message(error.message);}
