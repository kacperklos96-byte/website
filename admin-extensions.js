import {
 addDoc,collection,deleteDoc,doc,getDoc,getDocs,limit,orderBy,query,
 serverTimestamp,setDoc,updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {authenticated,firebaseClient,when} from "./community-data.js";
const $=id=>document.getElementById(id);
let db,user,isAdmin=false,loading=false;
function status(message,error=false){$("admin-extended-status").textContent=message;$("admin-extended-status").className="community-state"+(error?" error":"");}
function empty(parent,text){parent.replaceChildren();const p=document.createElement("p");p.className="community-blank";p.textContent=text;parent.append(p);}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function optionSelect(values,current){
 const select=el("select","community-select");
 for(const [value,label] of values){const o=new Option(label,value);select.add(o);}
 select.value=current;return select;
}
function reportRow(snap){
 const d=snap.data(),row=el("article","admin-report-row");
 const title=el("strong","",d.title+" · "+d.kind.toUpperCase());
 const details=el("p","",d.details),time=el("small","",when(d.createdAt));
 const meta=el("p","", "From: "+d.reporterUid+(d.targetUid?" · Target: "+d.targetUid:"")+
 (d.groupId?" · Group: "+d.groupId:""));
 const statusField=optionSelect([["open","Open"],["reviewing","Reviewing"],["resolved","Resolved"],["dismissed","Dismissed"]],d.status);
 const note=el("textarea","community-textarea");note.value=d.staffNote||"";note.maxLength=1000;note.rows=2;
 note.placeholder="Internal staff note";note.style.width="100%";
 const save=el("button","community-button primary","Save review");save.type="button";
 save.addEventListener("click",async()=>{
  save.disabled=true;try{
   await updateDoc(doc(db,"reports",snap.id),{status:statusField.value,staffNote:note.value.trim().slice(0,1000),
    handledBy:user.uid,updatedAt:serverTimestamp()});
   status("Incident report updated.");
  }catch(error){status(error.message,true);}finally{save.disabled=false;}
 });
 row.append(title,details,time,meta,statusField,note,save);return row;
}
function ticketRow(snap){
 const d=snap.data(),row=el("article","admin-report-row");
 const title=el("strong","",d.subject+" · "+d.status),body=el("p","",d.body);
 const meta=el("small","", "From: "+d.createdBy+" · "+when(d.createdAt));
 const choices=optionSelect([["open","Open"],["working","Working"],["resolved","Resolved"],["closed","Closed"]],d.status);
 const note=el("textarea","community-textarea");note.value=d.staffNote||"";note.maxLength=1000;note.rows=2;
 note.placeholder="Response visible to ticket owner";note.style.width="100%";
 const save=el("button","community-button primary","Update ticket");save.type="button";
 save.addEventListener("click",async()=>{
  save.disabled=true;try{
   await updateDoc(doc(db,"supportTickets",snap.id),{status:choices.value,staffNote:note.value.trim().slice(0,1000),
    updatedAt:serverTimestamp()});status("Ticket updated. The member will see your response.");
  }catch(error){status(error.message,true);}finally{save.disabled=false;}
 });
 row.append(title,body,meta,choices,note,save);return row;
}
async function loadReports(){
 const list=$("admin-report-list");empty(list,"Loading reports…");
 try{
  const snap=await getDocs(query(collection(db,"reports"),orderBy("createdAt","desc"),limit(40)));
  list.replaceChildren();
  if(snap.empty){empty(list,"No incident or user reports yet.");return;}
  snap.docs.forEach(d=>list.append(reportRow(d)));
 }catch(error){empty(list,"Reports unavailable: "+error.message);}
}
async function loadTickets(){
 const list=$("admin-ticket-list");empty(list,"Loading tickets…");
 try{
  const snap=await getDocs(query(collection(db,"supportTickets"),orderBy("createdAt","desc"),limit(40)));
  list.replaceChildren();
  if(snap.empty){empty(list,"No tickets submitted.");return;}
  snap.docs.forEach(d=>list.append(ticketRow(d)));
 }catch(error){empty(list,"Tickets unavailable: "+error.message);}
}
async function loadAnnouncements(){
 const list=$("admin-announcements");empty(list,"Loading announcements…");
 try{
  const snap=await getDocs(query(collection(db,"siteAnnouncements"),orderBy("createdAt","desc"),limit(20)));
  list.replaceChildren();
  if(snap.empty){empty(list,"No announcements.");return;}
  snap.docs.forEach(s=>{
   const d=s.data(),row=el("article","admin-report-row");
   row.append(el("strong","",d.title+" · "+(d.active?"Published":"Hidden")),el("p","",d.body));
   const toggle=el("button","community-button",d.active?"Unpublish":"Publish");
   toggle.type="button";toggle.addEventListener("click",async()=>{
    toggle.disabled=true;try{await updateDoc(doc(db,"siteAnnouncements",s.id),{active:!d.active,updatedAt:serverTimestamp()});await loadAnnouncements();}
    catch(error){status(error.message,true);}finally{toggle.disabled=false;}
   });
   const remove=el("button","community-button","Delete");remove.type="button";
   remove.addEventListener("click",async()=>{
    if(!confirm("Delete this announcement?"))return;
    try{await deleteDoc(doc(db,"siteAnnouncements",s.id));await loadAnnouncements();}catch(error){status(error.message,true);}
   });
   row.append(toggle,remove);list.append(row);
  });
 }catch(error){empty(list,"Announcements unavailable: "+error.message);}
}
async function loadSettings(){
 try{
  const snap=await getDoc(doc(db,"siteConfig","main"));
  const d=snap.exists()?snap.data():{};
  $("admin-maintenance").value=String(d.maintenance===true);
  $("admin-maintenance-message").value=d.message||"";
  $("admin-flag-social").checked=d.features?.social!==false;
  $("admin-flag-tasks").checked=d.features?.tasks!==false;
  $("admin-flag-calendar").checked=d.features?.calendar!==false;
 }catch(error){status("Couldn't load site settings: "+error.message,true);}
}
async function loadAudit(){
 const list=$("admin-audit-list");empty(list,"Loading trusted audit entries…");
 try{
  const snap=await getDocs(query(collection(db,"adminAudit"),orderBy("createdAt","desc"),limit(50)));
  list.replaceChildren();
  if(snap.empty){empty(list,"No trusted Admin SDK actions logged yet.");return;}
  snap.docs.forEach(s=>{
   const d=s.data(),row=el("div","admin-report-row");
   row.append(el("strong","",d.action||"Admin action"),el("small","", "UID "+(d.targetUid||"—")+" · "+when(d.createdAt)),
    el("p","",d.details||""));list.append(row);
  });
 }catch(error){empty(list,"Audit log unavailable: "+error.message);}
}
$("admin-reload-reports").addEventListener("click",loadReports);
$("admin-reload-tickets").addEventListener("click",loadTickets);
$("admin-reload-audit").addEventListener("click",loadAudit);
$("admin-announcement-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!isAdmin)return;
 const title=$("admin-announcement-title").value.trim(),body=$("admin-announcement-body").value.trim();
 if(title.length<2||title.length>100||body.length<2||body.length>1000){status("Invalid announcement.",true);return;}
 try{
  await addDoc(collection(db,"siteAnnouncements"),{title,body,active:true,createdBy:user.uid,
   createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  $("admin-announcement-form").reset();status("Announcement published.");
  await loadAnnouncements();
 }catch(error){status(error.message,true);}
});
$("admin-site-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!isAdmin)return;
 const message=$("admin-maintenance-message").value.trim();
 if(message.length>300){status("Maintenance message too long.",true);return;}
 try{
  await setDoc(doc(db,"siteConfig","main"),{
   maintenance:$("admin-maintenance").value==="true",message,
   features:{social:$("admin-flag-social").checked,tasks:$("admin-flag-tasks").checked,
     calendar:$("admin-flag-calendar").checked},
   updatedAt:serverTimestamp(),updatedBy:user.uid
  });status("Site settings saved (UI presentation controls only).");
 }catch(error){status(error.message,true);}
});
$("admin-copy-command").addEventListener("click",async()=>{
 if(!isAdmin)return;
 const uid=$("admin-action-uid").value.trim();
 if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid)){status("Enter a valid Firebase Auth UID.",true);return;}
 const action=$("admin-action-type").value,role=$("admin-role-value").value;
 const command="node scripts/admin-tools.mjs "+action+" "+uid+(action==="role"?" "+role:"");
 try{await navigator.clipboard.writeText(command);status("Copied: "+command);}
 catch(error){status("Copy failed. Command: "+command,true);}
});
$("admin-action-type").addEventListener("change",()=>{
 $("admin-role-value").disabled=$("admin-action-type").value!=="role";
});
try{
 const c=firebaseClient();db=c.db;
 authenticated(c.auth,async u=>{
  try{
   const token=await u.getIdTokenResult(true);
   isAdmin=token.claims.admin===true;
   const staffRole=String(token.claims.staffRole||"");
   if(!isAdmin&&!["owner","admin","moderator","support"].includes(staffRole))return;
   user=u;$("admin-extensions").hidden=false;
   $("admin-owner-tools").hidden=!isAdmin;
   $("admin-backend-tools").hidden=!isAdmin;
   $("admin-reload-audit").disabled=!isAdmin;
   $("admin-security-status").textContent=isAdmin?"Administrator verified with server-issued custom claim.":"Staff role: "+staffRole;
   await Promise.all([loadReports(),loadTickets()]);
   if(isAdmin)await Promise.all([loadSettings(),loadAnnouncements(),loadAudit()]);
   status("");
  }catch(error){status(error.message,true);}
 });
}catch(error){status(error.message,true);}
