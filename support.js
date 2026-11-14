import {addDoc,collection,limit,onSnapshot,orderBy,query,serverTimestamp,where} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {authenticated,firebaseClient,recordActivity,when} from "./community-data.js";
const $=id=>document.getElementById(id);
let db,user,sending=false;
function status(text,error=false){$("ticket-status").textContent=text;$("ticket-status").className="community-state"+(error?" error":"");}
function render(snap){
 const list=$("my-tickets");list.replaceChildren();
 if(snap.empty){const p=document.createElement("p");p.className="community-blank";p.textContent="You haven't created any tickets.";list.append(p);return;}
 snap.docs.sort((a,b)=>(b.data().createdAt?.seconds||0)-(a.data().createdAt?.seconds||0)).forEach(s=>{
  const d=s.data(),row=document.createElement("div");row.className="admin-report-row";
  const title=document.createElement("strong");title.textContent=d.subject+" · "+d.status;
  const body=document.createElement("p");body.textContent=d.body;
  const time=document.createElement("small");time.textContent=when(d.createdAt);
  row.append(title,body,time);
  if(d.staffNote){const note=document.createElement("p");note.textContent="Staff reply: "+d.staffNote;note.style.color="var(--text)";row.append(note);}
  list.append(row);
 });
}
function renderReports(snap){
 const list=$("my-reports");list.replaceChildren();
 if(snap.empty){const p=document.createElement("p");p.className="community-blank";p.textContent="You haven't submitted an incident report.";list.append(p);return;}
 snap.docs.sort((a,b)=>(b.data().createdAt?.seconds||0)-(a.data().createdAt?.seconds||0)).forEach(s=>{
  const d=s.data(),row=document.createElement("div");row.className="admin-report-row";
  const title=document.createElement("strong");title.textContent=d.title+" · "+d.status;
  const body=document.createElement("p");body.textContent=d.details;
  const time=document.createElement("small");time.textContent=when(d.createdAt);
  row.append(title,body,time);
  if(d.staffNote){const note=document.createElement("p");note.textContent="Staff update: "+d.staffNote;row.append(note);}
  list.append(row);
 });
}
$("ticket-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!user||sending)return;
 const subject=$("ticket-subject").value.trim(),body=$("ticket-body").value.trim();
 if(subject.length<3||subject.length>100||body.length<10||body.length>2000){status("Check your subject and details.",true);return;}
 sending=true;$("ticket-send").disabled=true;
 try{
  await addDoc(collection(db,"supportTickets"),{createdBy:user.uid,subject,body,status:"open",
    staffNote:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  $("ticket-form").reset();status("Ticket sent. Staff can now review your request.");
  recordActivity(db,user.uid,"support_ticket_created",subject.slice(0,100));
 }catch(e){status(e.code==="permission-denied"?"Publish the updated Firestore rules to submit tickets.":e.message,true);}
 finally{sending=false;$("ticket-send").disabled=false;}
});
try{
 const c=firebaseClient();db=c.db;
 authenticated(c.auth,u=>{
  user=u;
  onSnapshot(query(collection(db,"supportTickets"),where("createdBy","==",u.uid),limit(40)),render,
    err=>status("Couldn't read tickets: "+err.message,true));
  onSnapshot(query(collection(db,"reports"),where("reporterUid","==",u.uid),limit(40)),renderReports,
    err=>status("Couldn't read incident reports: "+err.message,true));
  status("");
 });
}catch(e){status(e.message,true);}
