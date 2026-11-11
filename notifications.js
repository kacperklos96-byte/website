import {
  collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy,
  query, updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { authenticated, firebaseClient, lookupPublicName, when } from "./community-data.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const list=document.getElementById("notifications-list");
const status=document.getElementById("page-status");
const markAll=document.getElementById("mark-all-read");
let db,user,items=[];
function clearAndText(text) {
  list.replaceChildren();
  const p=document.createElement("p");p.className="community-blank";p.textContent=text;
  list.appendChild(p);
}
function button(label, action) {
  const b=document.createElement("button");b.type="button";b.className="community-button";
  b.textContent=label;b.addEventListener("click",action);return b;
}
function threadUrl(data) {
  return "messages.html?thread="+encodeURIComponent(data.threadId);
}
function createRow(s, name, avatarData) {
  const n=s.data();
  const row=document.createElement("div");
  row.className="notice-row"+(n.read?"":" unread");
  const avatar=document.createElement("div");avatar.className="community-avatar small";
  renderAvatar(avatar,{avatarData});
  const info=document.createElement("div");info.className="member-text";
  const title=document.createElement("p");title.className="member-title";
  title.textContent=n.type==="message"
    ? "New message"+(name?" from "+name:"")
    : "Notification";
  const date=document.createElement("span");date.className="date";date.textContent=when(n.createdAt);
  info.append(title,date);
  const actions=document.createElement("div");actions.className="member-actions";
  const open=button("Open",async()=>{
    if(!n.read) {
      try{await updateDoc(doc(db,"notifications",user.uid,"items",s.id),{read:true});}
      catch(error){console.warn(error);}
    }
    location.assign(threadUrl(n));
  });
  actions.appendChild(open);
  if(!n.read)actions.appendChild(button("Mark read",async()=>{
    try{await updateDoc(doc(db,"notifications",user.uid,"items",s.id),{read:true});}
    catch(error){console.warn(error);}
  }));
  actions.appendChild(button("Remove",async()=>{
    try{await deleteDoc(doc(db,"notifications",user.uid,"items",s.id));}
    catch(error){console.warn(error);}
  }));
  row.append(avatar,info,actions);
  return row;
}
let serial=0;
async function refresh(snapshot) {
  const ownSerial=++serial;
  items=snapshot.docs;
  markAll.disabled=!items.some(s=>!s.data().read);
  if(items.length===0){clearAndText("You're all caught up! New message notifications will appear here.");return;}
  const records=await Promise.all(items.map(async s=>{
    const n=s.data();
    const p=await lookupPublicName(db,n.fromUid);
    return {snapshot:s,name:p?.displayName||"",avatarData:p?.avatarData||""};
  }));
  if(ownSerial!==serial)return;
  list.replaceChildren();
  records.forEach(x=>list.appendChild(createRow(x.snapshot,x.name,x.avatarData)));
}
markAll.addEventListener("click",async()=>{
  if(!user)return;
  markAll.disabled=true;
  const unread=items.filter(s=>!s.data().read);
  const results=await Promise.allSettled(unread.map(s=>
    updateDoc(doc(db,"notifications",user.uid,"items",s.id),{read:true})
  ));
  const failures=results.filter(x=>x.status==="rejected");
  if(failures.length)console.warn("Some alerts could not be marked read",failures);
});
try {
  const client=firebaseClient();db=client.db;
  authenticated(client.auth,u=>{
    user=u;
    const q=query(collection(db,"notifications",u.uid,"items"),orderBy("createdAt","desc"),limit(50));
    onSnapshot(q,refresh,error=>{
      clearAndText(error.code==="permission-denied"
        ? "Notifications need the updated Firestore rules to be published."
        : "Couldn't load notifications right now.");
      console.error(error);
    });
  });
}catch(error){clearAndText(error.message);}
