import {
  addDoc,arrayUnion,collection,deleteDoc,doc,getDoc,limit,limitToLast,
  onSnapshot,orderBy,query,runTransaction,serverTimestamp,setDoc,updateDoc,where,writeBatch
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {authenticated,firebaseClient,lookupPublicName,recordActivity,safeUid,sendMessage,when} from "./community-data.js";
import {renderAvatar} from "./avatar.js?v=mascot-1";
const $=id=>document.getElementById(id);
let db,user,mode="friends",selectedGroup=null,selectedChannel=null,recipient=null,threadId=null;
let friends=[],requests=[],groups=[],groupInvites=[],threads=[],channels=[],channelStreams=[],chatStop=null;
let stops=[],channelStop=[],pending=false,dialogSubmit=null,selectionSeq=0;
const friendNames=new Map();
function status(message,error=false){$("social-status").textContent=message;$("social-status").className="work-feedback"+(error?" error":"");}
function blank(message){const p=document.createElement("p");p.className="social-placeholder";p.textContent=message;return p;}
function button(label,fn,cls="community-button"){const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.addEventListener("click",fn);return b;}
function entry(title,info,callback,extra){
 const row=document.createElement("div");row.className="social-list-row";
 const data=document.createElement("div");data.className="social-row-info";
 const name=document.createElement("strong");name.textContent=title;
 const sub=document.createElement("small");sub.textContent=info||"";
 data.append(name,sub);row.append(data);
 if(callback)row.append(button(extra||"Open",callback));return row;
}
function sideButton(text,icon,callback,selected=false){
 const b=document.createElement("button");b.className="social-entry"+(selected?" active":"");
 b.type="button";const i=document.createElement("i");i.className="fas fa-"+icon;i.setAttribute("aria-hidden","true");
 const span=document.createElement("span");span.textContent=text;b.append(i,span);b.addEventListener("click",callback);return b;
}
function clearChat(){
 if(chatStop){chatStop();chatStop=null;}
 recipient=null;threadId=null;selectedChannel=null;
 $("social-chat-body").replaceChildren(blank("Select a conversation or group channel."));
 $("social-message-text").value="";$("social-message-text").disabled=true;$("social-send").disabled=true;
}
function chatHeading(title,description){
 $("social-chat-title").textContent=title;$("social-chat-subtitle").textContent=description||"";
}
function compose(enabled){
 $("social-message-text").disabled=!enabled;
 $("social-send").disabled=!enabled;
}
async function nameOf(uid){
 if(friendNames.has(uid))return friendNames.get(uid);
 const p=await lookupPublicName(db,uid);
 const name=p?.displayName||p?.username||("Member "+uid.slice(0,7));
 friendNames.set(uid,name);return name;
}
function renderThreadMessages(snap){
 const chat=$("social-chat-body");chat.replaceChildren();
 if(snap.empty){chat.append(blank("No messages yet. Say hello!"));return;}
 snap.forEach(s=>{
  const d=s.data();
  const mine=d.senderUid===user.uid;
  const box=document.createElement("div");box.className="social-message"+(mine?" own":"");
  const p=document.createElement("p");p.textContent=d.body||"";
  const t=document.createElement("small");t.textContent=when(d.createdAt);
  box.append(p,t);chat.append(box);
 });chat.scrollTop=chat.scrollHeight;
}
async function selectDm(targetUid,existingThread=null){
 if(!user||!safeUid(targetUid)||targetUid===user.uid)return;
 const serial=++selectionSeq;mode="dm";selectedGroup=null;
 clearChannelWatch();
 clearChat();recipient=targetUid;
 $("social-column-title").textContent="Direct messages";$("social-channel-add").hidden=true;$("social-invite-member").hidden=true;
 const middle=$("social-middle");middle.replaceChildren(blank("Your private conversation. Use Find people to discover more members."));
 chatHeading("Loading conversation…","Private messages");
 renderRail();
 const name=await nameOf(targetUid);if(serial!==selectionSeq)return;
 chatHeading(name,"Direct message");
 threadId=existingThread||[targetUid,user.uid].sort().join("_");
 history.replaceState(null,"","messages.html?to="+encodeURIComponent(targetUid));
 try{
  const ref=doc(db,"threads",threadId);const record=await getDoc(ref);
  if(serial!==selectionSeq)return;
  if(record.exists()){
   chatStop=onSnapshot(query(collection(db,"threads",threadId,"messages"),orderBy("createdAt","asc"),limitToLast(40)),renderThreadMessages,
      err=>status("Couldn't load this conversation: "+err.message,true));
  }else $("social-chat-body").replaceChildren(blank("No conversation yet. Write a message to start."));
 }catch(error){status(error.message,true);}
 compose(true);
}
function clearChannelWatch(){
 channelStop.forEach(fn=>fn());channelStop=[];channels=[];
 $("social-channel-add").hidden=true;$("social-invite-member").hidden=true;
}
function groupMember(){return !!selectedGroup?.data.members?.includes(user?.uid);}
function groupOwner(){return selectedGroup?.data.ownerUid===user?.uid;}
function channelVisible(c){return groupMember()&&(!c.private || c.allowedUids?.includes(user.uid) || groupOwner());}
function renderChannelList(){
 const panel=$("social-middle");panel.replaceChildren();
 const g=selectedGroup;
 if(!g){panel.append(blank("Choose a group."));return;}
 const caption=document.createElement("p");caption.className="social-placeholder";
 caption.style.padding="4px 6px";caption.textContent=g.data.description||"Your private group";panel.append(caption);
 if(!channels.length)panel.append(blank("No channels accessible yet."));
 for(const c of [...channels].sort((a,b)=>a.data.name.localeCompare(b.data.name))){
  const d=c.data;
  const row=sideButton((d.private?"🔒 ":"# ")+d.name,d.kind==="incident"?"flag":"hashtag",()=>selectChannel(c),selectedChannel?.id===c.id);
  panel.append(row);
  if(groupOwner()&&d.private){
    const edit=button("Access",()=>editChannelAccess(c));edit.className="community-button";
    edit.style.margin="2px 8px 8px";edit.style.fontSize="11px";panel.append(edit);
  }
 }
}
function startChannels(){
 clearChannelWatch();
 if(!selectedGroup)return;
 const gid=selectedGroup.id;
 const col=collection(db,"groups",gid,"channels");
 const watch=(q)=>onSnapshot(q,snap=>{
   if(!selectedGroup||selectedGroup.id!==gid)return;
   for(const change of snap.docChanges()){
     const record={id:change.doc.id,data:change.doc.data()};
     if(change.type==="removed")channels=channels.filter(x=>x.id!==record.id);
     else channels=[...channels.filter(x=>x.id!==record.id),record];
   }
   channels=channels.filter(c=>channelVisible(c.data));
   renderChannelList();
 },err=>status("Channels unavailable: "+err.message,true));
 if(groupOwner())channelStop.push(watch(query(col,limit(50))));
 else{
  channelStop.push(watch(query(col,where("private","==",false),limit(50))));
  channelStop.push(watch(query(col,where("allowedUids","array-contains",user.uid),limit(50))));
 }
}
function setSelectedGroup(group){
 ++selectionSeq;mode="group";selectedGroup=group;
 clearChat();
 $("social-column-title").textContent=group.data.name;
 $("social-channel-add").hidden=!groupOwner();
 $("social-invite-member").hidden=!groupOwner();
 chatHeading(group.data.name,"Select a channel");
 $("social-chat-body").replaceChildren(blank("Choose a channel on the left."));
 renderRail();startChannels();
 history.replaceState(null,"","messages.html?group="+encodeURIComponent(group.id));
}
function selectChannel(c){
 if(!selectedGroup||!channelVisible(c.data))return;
 if(chatStop){chatStop();chatStop=null;}
 selectedChannel=c;recipient=null;threadId=null;mode="group";
 chatHeading("# "+c.data.name,(c.data.private?"Restricted channel · ":"Group channel · ")+(c.data.kind==="incident"?"Incidents":"Text chat"));
 compose(true);$("social-chat-body").replaceChildren(blank("Loading channel messages…"));
 const gid=selectedGroup.id,cid=c.id;
 chatStop=onSnapshot(query(collection(db,"groups",gid,"channels",cid,"posts"),orderBy("createdAt","asc"),limitToLast(60)),snap=>{
  const chat=$("social-chat-body");chat.replaceChildren();
  if(snap.empty){chat.append(blank("No messages in this channel yet."));return;}
  const serial=++selectionSeq;
  const items=snap.docs.map(d=>d.data());
  Promise.all([...new Set(items.map(x=>x.senderUid))].map(async uid=>[uid,await nameOf(uid)])).then(pairs=>{
   if(serial!==selectionSeq||selectedChannel?.id!==cid)return;
   const names=new Map(pairs);
   for(const item of items){
    const row=document.createElement("div");row.className="social-message"+(item.senderUid===user.uid?" own":"");
    const h=document.createElement("strong");h.textContent=item.senderUid===user.uid?"You":(names.get(item.senderUid)||"Member");
    const body=document.createElement("p");body.textContent=item.body;
    const t=document.createElement("small");t.textContent=when(item.createdAt);
    row.append(h,body,t);chat.append(row);
   }chat.scrollTop=chat.scrollHeight;
  });
 },err=>status("Couldn't read channel: "+err.message,true));
 renderChannelList();
 history.replaceState(null,"","messages.html?group="+encodeURIComponent(gid)+"&channel="+encodeURIComponent(cid));
}
function renderRail(){
 const dm=$("social-dms");dm.replaceChildren();
 if(!threads.length)dm.append(blank("No messages yet"));
 for(const t of threads.slice(0,30)){
  const other=t.data.members?.find(id=>id!==user?.uid);if(!other)continue;
  const item=sideButton(friendNames.get(other)||"Member "+other.slice(0,7),"comment-alt",()=>selectDm(other,t.id),mode==="dm"&&recipient===other);
  dm.append(item);nameOf(other).then(()=>{const s=item.querySelector("span");if(s)s.textContent=friendNames.get(other);});
 }
 const gr=$("social-groups");gr.replaceChildren();
 if(!groups.length)gr.append(blank("No groups yet"));
 for(const group of groups){
  gr.append(sideButton(group.data.name,"users",()=>setSelectedGroup(group),mode==="group"&&selectedGroup?.id===group.id));
 }
 $("social-friends").classList.toggle("active",mode==="friends");
 $("social-invites").classList.toggle("active",mode==="invites");
}
function allFriends(){
 return requests.filter(x=>x.data.status==="accepted").map(x=>({
  id:x.id,uid:x.data.fromUid===user.uid?x.data.toUid:x.data.fromUid,data:x.data
 }));
}
function renderFriends(){
 if(mode!=="friends")return;
 renderRail();
 $("social-column-title").textContent="Friends & requests";$("social-channel-add").hidden=true;$("social-invite-member").hidden=true;
 const middle=$("social-middle");middle.replaceChildren();
 const pendingIn=requests.filter(x=>x.data.status==="pending"&&x.data.toUid===user.uid);
 const outgoing=requests.filter(x=>x.data.status==="pending"&&x.data.fromUid===user.uid);
 const sections=[["Incoming requests",pendingIn],["Friends",allFriends()],["Sent requests",outgoing]];
 for(const [label,items] of sections){
  const h=document.createElement("h3");h.className="social-nav-label";h.textContent=label+" · "+items.length;middle.append(h);
  if(!items.length)middle.append(blank("None yet"));
  for(const item of items){
   const uid=item.uid||(item.data.fromUid===user.uid?item.data.toUid:item.data.fromUid);
   const row=entry(friendNames.get(uid)||uid.slice(0,9),label==="Friends"?"Friend":"Friend request",
    label==="Friends"?()=>selectDm(uid):()=>changeRequest(item.id,label==="Incoming requests"?"accepted":"cancel"),
    label==="Friends"?"Message":label==="Incoming requests"?"Accept":"Cancel");
   const controls=row.querySelector("button");
   if(label==="Friends"){
    row.append(button("Remove",()=>removeFriend(item.id)));
   }else if(label==="Incoming requests")row.append(button("Decline",()=>changeRequest(item.id,"declined")));
   middle.append(row);nameOf(uid).then(n=>row.querySelector("strong").textContent=n);
  }
 }
}
async function removeFriend(id){
 if(!confirm("Remove this friend?"))return;
 try{await deleteDoc(doc(db,"friendRequests",id));status("Friend removed.");}catch(e){status(e.message,true);}
}
async function changeRequest(id,result){
 try{
  if(result==="cancel")await deleteDoc(doc(db,"friendRequests",id));
  else await updateDoc(doc(db,"friendRequests",id),{status:result,updatedAt:serverTimestamp()});
  status(result==="accepted"?"Friend request accepted.":result==="declined"?"Request declined.":"Request cancelled.");
 }catch(e){status(e.code==="permission-denied"?"Friend permissions denied. Publish the updated Firestore rules.":e.message,true);}
}
function showFriends(){
 ++selectionSeq;mode="friends";selectedGroup=null;clearChannelWatch();clearChat();chatHeading("Friends","Accept requests and start direct messages");
 renderFriends();history.replaceState(null,"","messages.html?friends");
}
function renderInvites(){
 if(mode!=="invites")return;
 renderRail();$("social-column-title").textContent="Group invitations";$("social-channel-add").hidden=true;$("social-invite-member").hidden=true;
 const panel=$("social-middle");panel.replaceChildren();
 if(!groupInvites.length)panel.append(blank("No group invitations."));
 for(const inv of groupInvites){
  const row=entry(inv.data.groupName||"Private group","Invited by "+inv.data.fromUid.slice(0,8),()=>acceptInvite(inv),"Join");
  row.append(button("Decline",()=>deleteDoc(doc(db,"groupInvites",inv.id)).catch(e=>status(e.message,true))));
  panel.append(row);
 }
}
function showInvites(){
 ++selectionSeq;mode="invites";selectedGroup=null;clearChannelWatch();clearChat();chatHeading("Group invitations","Join private spaces you've been invited into");
 renderInvites();history.replaceState(null,"","messages.html?invites");
}
async function acceptInvite(inv){
 try{
  await updateDoc(doc(db,"groups",inv.data.groupId),{members:arrayUnion(user.uid),updatedAt:serverTimestamp()});
  await deleteDoc(doc(db,"groupInvites",inv.id));
  status("Joined group!");recordActivity(db,user.uid,"group_joined",String(inv.data.groupName).slice(0,90));
 }catch(e){status(e.code==="permission-denied"?"Couldn't join. Your invite may have expired or the rules need publishing.":e.message,true);}
}
function showModal(title,fields,onSubmit){
 $("social-dialog-title").textContent=title;
 const root=$("social-dialog-fields");root.replaceChildren();
 for(const field of fields){
  const label=document.createElement("label");label.className="community-field";
  label.textContent=field.label;
  const control=field.type==="textarea"?document.createElement("textarea"):field.type==="select"?document.createElement("select"):document.createElement("input");
  control.className=field.type==="textarea"?"community-textarea":field.type==="select"?"community-select":"community-input";
  control.name=field.name;control.id="dialog-"+field.name;
  if(field.type==="select")for(const option of field.options){
   const opt=document.createElement("option");opt.value=option[0];opt.textContent=option[1];control.append(opt);
  }
  else if(field.type==="textarea"){control.rows=3;control.maxLength=field.max||1000;}
  else{control.type=field.type||"text";control.maxLength=field.max||120;}
  if(field.value!==undefined)control.value=field.value;
  control.required=!!field.required;
  label.append(control);root.append(label);
 }
 $("social-dialog-error").textContent="";dialogSubmit=onSubmit;$("social-dialog").showModal();
}
$("social-dialog-cancel").addEventListener("click",()=>$("social-dialog").close());
$("social-dialog-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!dialogSubmit||pending)return;
 const data=Object.fromEntries(new FormData(e.currentTarget).entries());
 pending=true;$("social-dialog-save").disabled=true;$("social-dialog-error").textContent="";
 try{await dialogSubmit(data);$("social-dialog").close();}
 catch(error){console.error(error);$("social-dialog-error").textContent=error.code==="permission-denied"?"Permission denied. Publish the current Firestore rules or check your group permissions.":error.message;}
 finally{pending=false;$("social-dialog-save").disabled=false;}
});
$("new-group").addEventListener("click",()=>showModal("Create a group",[
 {name:"name",label:"Group name",max:45,required:true},
 {name:"description",label:"Description",type:"textarea",max:200}
],async d=>{
 const name=d.name.trim(),description=d.description.trim();
 if(name.length<2||name.length>45||description.length>200)throw Error("Please enter a valid group name and description.");
 const groupRef=doc(collection(db,"groups"));
 const base=collection(groupRef,"channels");
 const general=doc(base),incidents=doc(base);
 const batch=writeBatch(db);
 batch.set(groupRef,{ownerUid:user.uid,name,description,members:[user.uid],createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 batch.set(general,{name:"general",private:false,allowedUids:[user.uid],kind:"text",createdAt:serverTimestamp(),createdBy:user.uid});
 batch.set(incidents,{name:"incident-reports",private:true,allowedUids:[user.uid],kind:"incident",createdAt:serverTimestamp(),createdBy:user.uid});
 await batch.commit();
 status("Group created. #incident-reports is private to you until you grant access.");
}));
$("social-channel-add").addEventListener("click",()=>{
 if(!selectedGroup||!groupOwner())return;
 showModal("Create a channel",[
 {name:"name",label:"Channel name (letters, numbers and hyphens)",max:40,required:true},
 {name:"kind",label:"Type",type:"select",options:[["text","Text"],["incident","Incidents"]]},
 {name:"privacy",label:"Who can see it?",type:"select",options:[["public","All group members"],["private","Restricted / private"]]}
 ],async d=>{
  const name=d.name.toLowerCase().trim().replace(/\s+/g,"-");
  if(!/^[a-z0-9-]{2,40}$/.test(name))throw Error("Channel name must be 2–40 letters, numbers or hyphens.");
  await addDoc(collection(db,"groups",selectedGroup.id,"channels"),{
   name,private:d.privacy==="private",allowedUids:[user.uid],kind:d.kind,createdBy:user.uid,createdAt:serverTimestamp()
  });status("Channel created.");
 });
});
function editChannelAccess(c){
 if(!groupOwner())return;
 const members=selectedGroup.data.members.filter(uid=>uid!==user.uid);
 if(!members.length){status("Invite a friend into the group before granting channel access.",true);return;}
 showModal("Private channel access",[
  {name:"uid",label:"Group member",type:"select",
   options:members.map(uid=>[uid,friendNames.get(uid)||"Member "+uid.slice(0,8)])},
  {name:"operation",label:"Permission",type:"select",
   options:[["allow","Allow channel access"],["remove","Remove channel access"]]}
 ],async d=>{
  const target=d.uid;
  if(!members.includes(target))throw Error("Choose a current member.");
  const allowed=new Set(c.data.allowedUids||[user.uid]);
  if(d.operation==="allow")allowed.add(target);
  else allowed.delete(target);
  allowed.add(user.uid);
  await updateDoc(doc(db,"groups",selectedGroup.id,"channels",c.id),{allowedUids:[...allowed]});
  status("Channel permissions updated.");
 });
}
$("social-invite-member").addEventListener("click",()=>{
 if(!groupOwner())return;
 const available=allFriends().filter(x=>!selectedGroup.data.members.includes(x.uid));
 if(!available.length){status("Add a friend in Find people first, then invite them here.",true);return;}
 showModal("Invite a friend",[
  {name:"uid",label:"Choose a friend",type:"select",
   options:available.map(x=>[x.uid,friendNames.get(x.uid)||"Member "+x.uid.slice(0,8)])},
 ],async d=>{
  const target=d.uid.trim();
  if(!safeUid(target)||target===user.uid||selectedGroup.data.members.includes(target))throw Error("Enter the UID of another user who isn't in this group.");
  if(available.length&&!available.some(x=>x.uid===target))throw Error("Invite someone from your friends list.");
  if(!available.length)throw Error("Add a friend first, then invite them to the group.");
  const publicProfile=await getDoc(doc(db,"publicProfiles",target));
  if(!publicProfile.exists())throw Error("This person must have an opt-in public profile to receive the invitation.");
  await setDoc(doc(db,"groupInvites",selectedGroup.id+"_"+target),{
   groupId:selectedGroup.id,toUid:target,fromUid:user.uid,groupName:selectedGroup.data.name,createdAt:serverTimestamp()
  });
  status("Group invite sent. They can accept it under Group invitations.");
 });
});
$("social-report").addEventListener("click",()=>showModal("Send a private report",[
 {name:"kind",label:"Report type",type:"select",options:[["incident","Incident"],["account","Account"],["message","Message"],["other","Other"]]},
 {name:"title",label:"Short summary",max:100,required:true},
 {name:"details",label:"What happened? (visible only to staff and you)",type:"textarea",max:1600,required:true},
 {name:"targetUid",label:"Reported member UID (optional)",max:128}
],async d=>{
 const title=d.title.trim(),details=d.details.trim(),targetUid=d.targetUid.trim();
 if(title.length<3||title.length>100||details.length<10||details.length>1600||targetUid&&!safeUid(targetUid))throw Error("Please enter a summary, at least 10 characters of details and a valid UID if provided.");
 await addDoc(collection(db,"reports"),{
   kind:d.kind,title,details,targetUid,
   reporterUid:user.uid,groupId:selectedGroup?.id||"",channelId:selectedChannel?.id||"",
   status:"open",staffNote:"",handledBy:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()
 });status("Report submitted privately to the moderation queue.");
}));
$("social-compose").addEventListener("submit",async e=>{
 e.preventDefault();
 if(pending||!user)return;
 const body=$("social-message-text").value.trim();if(!body||body.length>700)return;
 pending=true;$("social-send").disabled=true;
 try{
  if(mode==="group"&&selectedGroup&&selectedChannel){
    await addDoc(collection(db,"groups",selectedGroup.id,"channels",selectedChannel.id,"posts"),{
      senderUid:user.uid,body,createdAt:serverTimestamp()
    });
  }else if(mode==="dm"&&recipient){
    const tid=await sendMessage(db,user,recipient,body);
    if(threadId!==tid||!chatStop)await selectDm(recipient,tid);
    recordActivity(db,user.uid,"message_sent","Sent a private message");
  }else throw Error("Select a conversation first.");
  $("social-message-text").value="";status("");
 }catch(error){status(error.code==="permission-denied"?"Message denied. You may need the latest Firestore rules, a public profile, or friendship permission.":error.message,true);}
 finally{pending=false;$("social-send").disabled=false;}
});
$("social-friends").addEventListener("click",showFriends);
$("social-invites").addEventListener("click",showInvites);
function startSubscriptions(){
 stops.forEach(fn=>fn());stops=[];
 const uid=user.uid;
 const reqs={from:[],to:[]};
 const onFriend=(direction)=>snap=>{
  reqs[direction]=snap.docs.map(s=>({id:s.id,data:s.data()}));
  requests=[...new Map([...reqs.from,...reqs.to].map(r=>[r.id,r])).values()];
  friends=allFriends();
  if(mode==="friends")renderFriends();
 };
 stops.push(onSnapshot(query(collection(db,"friendRequests"),where("fromUid","==",uid),limit(50)),onFriend("from"),e=>status(e.message,true)));
 stops.push(onSnapshot(query(collection(db,"friendRequests"),where("toUid","==",uid),limit(50)),onFriend("to"),e=>status(e.message,true)));
 stops.push(onSnapshot(query(collection(db,"groupInvites"),where("toUid","==",uid),limit(40)),snap=>{
  groupInvites=snap.docs.map(d=>({id:d.id,data:d.data()}));if(mode==="invites")renderInvites();
 },e=>status(e.message,true)));
 stops.push(onSnapshot(query(collection(db,"groups"),where("members","array-contains",uid),limit(40)),snap=>{
  groups=snap.docs.map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.data.name.localeCompare(b.data.name));
  if(selectedGroup){
   const updated=groups.find(g=>g.id===selectedGroup.id);
   if(updated)selectedGroup=updated;
   else{clearChannelWatch();selectedGroup=null;showFriends();}
  }
  renderRail();
 },e=>status(e.message,true)));
 stops.push(onSnapshot(query(collection(db,"threads"),where("members","array-contains",uid),limit(30)),snap=>{
  threads=snap.docs.map(d=>({id:d.id,data:d.data()}))
   .sort((a,b)=>(b.data.lastSentAt?.seconds||0)-(a.data.lastSentAt?.seconds||0));
  renderRail();
 },e=>status(e.message,true)));
}
try{
 const c=firebaseClient();db=c.db;
 authenticated(c.auth,async u=>{
  user=u;$("new-group").disabled=false;startSubscriptions();
  const p=new URLSearchParams(location.search);
  if(p.has("to")&&safeUid(p.get("to")))await selectDm(p.get("to"));
  else if(p.has("thread")){
   try{const t=await getDoc(doc(db,"threads",p.get("thread")));
    const other=t.data()?.members?.find(x=>x!==u.uid);if(other)await selectDm(other,p.get("thread"));else showFriends();
   }catch(e){showFriends();}
  }else if(p.has("group")){
   try{
    const s=await getDoc(doc(db,"groups",p.get("group")));
    if(s.exists())setSelectedGroup({id:s.id,data:s.data()});
    else showFriends();
   }catch(e){showFriends();}
  }else if(p.has("invites"))showInvites();
  else showFriends();status("");
 });
}catch(error){status(error.message,true);}
