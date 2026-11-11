import {
  collection, deleteDoc, doc, getDoc, limit, limitToLast, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, where
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { authenticated, firebaseClient, lookupPublicName, recordActivity, safeUid, sendMessage, when } from "./community-data.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const $=id=>document.getElementById(id);
let db, auth, user, activeTid=null, activeOther=null, unblockMessageListener=null;
let pending=false, blocked=false, threadsIndex=[], recentSeq=0;
const nameCache=new Map();
function state(text, error=false) {
  $("message-feedback").textContent=text;
  $("message-feedback").className="community-state"+(error?" error":"");
}
async function otherProfile(uid) {
  if(nameCache.has(uid))return nameCache.get(uid);
  const profile=await lookupPublicName(db,uid);
  nameCache.set(uid,profile);
  return profile;
}
function setComposer() {
  const canSend=!!activeOther && !blocked && !pending;
  $("message-input").disabled=!canSend;
  $("send-message").disabled=!canSend;
  $("block-user").hidden=!activeOther || blocked;
  $("unblock-user").hidden=!activeOther || !blocked;
}
async function updateBlocked(uid) {
  blocked=false;setComposer();
  if(!uid||!user)return;
  try {
    const snap=await getDoc(doc(db,"blocks",user.uid,"targets",uid));
    if(activeOther!==uid)return;
    blocked=snap.exists();setComposer();
    if(blocked)state("This member is blocked. Unblock them to send another message.");
  }catch(error){console.warn("Block list unavailable:",error);state("Could not check block list.",true);}
}
async function showChatHeader(uid) {
  const profile=await otherProfile(uid);
  if(activeOther!==uid)return;
  renderAvatar($("chat-avatar"),profile);
  $("chat-name").textContent=profile?.displayName||"Member";
  $("chat-handle").textContent=profile?.username?"@"+profile.username:"Private account";
  await updateBlocked(uid);
}
function renderMessages(snapshot) {
  const box=$("chat-messages");box.replaceChildren();
  if(snapshot.empty) {
    const p=document.createElement("p");p.className="community-blank";
    p.textContent="No messages yet. Say hello!";box.appendChild(p);return;
  }
  snapshot.forEach(s=>{
    const data=s.data();const bubble=document.createElement("div");
    bubble.className="chat-bubble"+(data.senderUid===user.uid?" own":"");
    const text=document.createElement("span");text.textContent=data.body||"";
    const time=document.createElement("small");time.textContent=when(data.createdAt);
    bubble.append(text,time);box.appendChild(bubble);
  });
  box.scrollTop=box.scrollHeight;
}
async function chooseThread(tid) {
  if(unblockMessageListener){unblockMessageListener();unblockMessageListener=null;}
  try {
    const snap=await getDoc(doc(db,"threads",tid));
    if(!snap.exists())throw new Error("Conversation no longer exists.");
    const members=snap.data().members||[];
    if(!members.includes(user.uid)||members.length!==2)throw new Error("This conversation isn't available.");
    activeTid=tid;activeOther=members.find(x=>x!==user.uid);
    setComposer();state("");
    history.replaceState(null,"","messages.html?thread="+encodeURIComponent(tid));
    await showChatHeader(activeOther);
    const q=query(collection(db,"threads",tid,"messages"),orderBy("createdAt","asc"),limitToLast(40));
    unblockMessageListener=onSnapshot(q,renderMessages,error=>{
      state("Couldn't load messages. Check your Firestore rules.",true);
      console.error(error);
    });
  }catch(error){state(error.message||"Couldn't open conversation.",true);}
}
async function chooseRecipient(uid) {
  if(!safeUid(uid)||uid===user.uid){state("Choose another member.",true);return;}
  const tid=[user.uid,uid].sort().join("_");
  const existing=threadsIndex.find(item=>item.id===tid);
  if(existing){await chooseThread(tid);return;}
  if(unblockMessageListener){unblockMessageListener();unblockMessageListener=null;}
  activeTid=null;activeOther=uid;blocked=false;state("");
  $("chat-messages").replaceChildren();
  const info=document.createElement("p");info.className="community-blank";
  info.textContent="No conversation yet. Send a message to start one.";
  $("chat-messages").appendChild(info);
  await showChatHeader(uid);
  setComposer();
}
function clickableThread(thread, profile) {
  const row=document.createElement("button");row.type="button";row.className="message-thread-row";
  if(thread.id===activeTid)row.classList.add("selected");
  const avatar=document.createElement("div");avatar.className="community-avatar small";
  renderAvatar(avatar,profile);
  const text=document.createElement("div");text.className="member-text";
  const title=document.createElement("div");title.className="member-title";title.textContent=profile?.displayName||"Member";
  const preview=document.createElement("div");preview.className="member-description";
  preview.textContent=(thread.data.lastSenderUid===user.uid?"You: ":"")+String(thread.data.lastMessage||"").slice(0,110);
  text.append(title,preview);row.append(avatar,text);
  row.addEventListener("click",()=>chooseThread(thread.id));
  return row;
}
function listenThreads() {
  const q=query(collection(db,"threads"),where("members","array-contains",user.uid),limit(30));
  onSnapshot(q,async snap=>{
    const serial=++recentSeq;
    threadsIndex=snap.docs.map(x=>({id:x.id,data:x.data()}))
      .sort((a,b)=>(b.data.lastSentAt?.toMillis?.()||0)-(a.data.lastSentAt?.toMillis?.()||0));
    const parent=$("threads");parent.replaceChildren();
    if(!threadsIndex.length) {
      const p=document.createElement("p");p.className="community-blank";p.textContent="No conversations yet. Find a public profile to message.";parent.appendChild(p);return;
    }
    for(const thread of threadsIndex){
      const other=thread.data.members?.find(uid=>uid!==user.uid);
      if(!other)continue;
      const profile=await otherProfile(other);
      if(serial!==recentSeq)return;
      parent.appendChild(clickableThread(thread,profile));
    }
  },error=>{
    $("threads").textContent="Conversations unavailable. Publish the new Firestore rules.";
    console.error(error);
  });
}

$("send-form").addEventListener("submit",async e=>{
  e.preventDefault();
  if(pending||!user||!activeOther||blocked)return;
  const text=$("message-input").value.trim();
  if(!text||text.length>700){state("Write a message up to 700 characters.",true);return;}
  pending=true;setComposer();state("Sending…");
  try {
    const tid=await sendMessage(db,user,activeOther,text);
    $("message-input").value="";
    state("Message sent.");
    recordActivity(db,user.uid,"message_sent","Sent a private message");
    if(activeTid!==tid)await chooseThread(tid);
  }catch(error) {
    console.error(error);
    state(error.code==="permission-denied"
      ? "Message was blocked by permissions. Check the new Firestore rules, public profile visibility, or block status."
      : (error.message||"Unable to send message."),true);
  }finally{pending=false;setComposer();}
});
$("block-user").addEventListener("click",async()=>{
  if(!activeOther||!user)return;
  try {
    await setDoc(doc(db,"blocks",user.uid,"targets",activeOther),{blockedAt:serverTimestamp()});
    blocked=true;setComposer();state("Member blocked. They cannot send you new messages.");
  }catch(error){state("Couldn't block this member.",true);console.error(error);}
});
$("unblock-user").addEventListener("click",async()=>{
  if(!activeOther||!user)return;
  try {
    await deleteDoc(doc(db,"blocks",user.uid,"targets",activeOther));
    blocked=false;setComposer();state("Member unblocked.");
  }catch(error){state("Couldn't remove the block.",true);console.error(error);}
});

try {
  const client=firebaseClient();db=client.db;auth=client.auth;
  authenticated(auth,async u=>{
    user=u;listenThreads();
    const params=new URLSearchParams(location.search);
    const tid=params.get("thread");
    const to=params.get("to");
    if(tid)await chooseThread(tid);
    else if(to)await chooseRecipient(to);
    else setComposer();
  });
}catch(error){state(error.message,true);}
