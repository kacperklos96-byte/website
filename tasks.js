import {
  collection,addDoc,deleteDoc,doc,limit,onSnapshot,orderBy,query,
  serverTimestamp,Timestamp,updateDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {authenticated,firebaseClient,recordActivity} from "./community-data.js";
const $=id=>document.getElementById(id);
const dayString=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const stateLabels={todo:"To do",doing:"In progress",done:"Done"};
let db,user,tasks=[],editing=null,busy=false,stopListener=null,view="board";
function feedback(msg,error=false){$("tasks-status").textContent=msg;$("tasks-status").className="work-feedback"+(error?" error":"");}
function err(message){$("task-error").textContent=message;}
function priorityClass(priority){return ["high","medium","low"].includes(priority)?priority:"medium";}
function dateShort(s){if(!s)return"";const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{day:"numeric",month:"short"});}
function notificationText(task){return "Reminder: "+task.title;}
function dueCheck(){
  if(!user)return;
  const now=Date.now(),next=tasks.filter(t=>t.status!=="done"&&t.remindAt?.toMillis?.()&&t.remindAt.toMillis()<=now);
  for(const task of next){
    const key="task-reminder:"+user.uid+":"+task.id+":"+(task.remindAt?.seconds||"");
    if(sessionStorage.getItem(key))continue;
    sessionStorage.setItem(key,"1");
    feedback(notificationText(task));
    if("Notification" in window&&Notification.permission==="granted")
      new Notification("My Website — task reminder",{body:task.title});
  }
}
function entry(task,compact=false){
  const el=document.createElement("article");el.className="task-card";el.draggable=!compact;
  el.dataset.id=task.id;
  const title=document.createElement("div");title.className="task-card-title";title.textContent=task.title;
  const desc=document.createElement("p");desc.className="task-card-description";desc.textContent=task.description||"";
  const meta=document.createElement("div");meta.className="task-card-meta";
  const p=document.createElement("span");p.className="task-priority "+priorityClass(task.priority);p.textContent=task.priority||"medium";meta.append(p);
  if(task.dueDay){const due=document.createElement("span");due.textContent="Due "+dateShort(task.dueDay);
    if(task.dueDay<dayString(new Date())&&task.status!=="done")due.className="overdue";
    meta.append(due);}
  if(task.remindAt){const alarm=document.createElement("span");alarm.textContent="⏰ "+task.remindAt.toDate().toLocaleString(undefined,{dateStyle:"short",timeStyle:"short"});meta.append(alarm);}
  const actions=document.createElement("div");actions.className="task-actions";
  const state=document.createElement("select");state.className="community-select";state.setAttribute("aria-label","Move task to");
  Object.entries(stateLabels).forEach(([key,text])=>{const opt=new Option(text,key);state.add(opt);});
  state.value=task.status;state.addEventListener("change",async()=>{
    state.disabled=true;try{await updateDoc(doc(db,"taskBoards",user.uid,"items",task.id),{status:state.value,updatedAt:serverTimestamp()});}
    catch(e){feedback(e.message,true);state.value=task.status;}finally{state.disabled=false;}
  });
  const edit=document.createElement("button");edit.className="community-button";edit.type="button";edit.textContent="Edit";
  edit.addEventListener("click",()=>openTask(task));actions.append(state,edit);
  el.append(title);if(task.description)el.append(desc);el.append(meta,actions);
  el.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",task.id);e.dataTransfer.effectAllowed="move";});
  return el;
}
function render(){
  for(const status of ["todo","doing","done"]){
    const list=$(status+"-items");list.replaceChildren();
    const matching=tasks.filter(t=>t.status===status);
    $(status+"-count").textContent=String(matching.length);
    if(!matching.length){const p=document.createElement("p");p.className="work-empty";p.textContent="Nothing here yet";list.append(p);}
    else matching.forEach(t=>list.append(entry(t)));
  }
  const list=$("list");list.replaceChildren();
  if(!tasks.length){const p=document.createElement("p");p.className="work-empty";p.textContent="Your task list is empty. Create a task to begin.";list.append(p);}
  tasks.filter(t=>t.status!=="done").concat(tasks.filter(t=>t.status==="done")).forEach(t=>list.append(entry(t,true)));
  const reminders=$("reminders");reminders.replaceChildren();
  const pending=tasks.filter(t=>t.remindAt&&t.status!=="done").sort((a,b)=>a.remindAt.seconds-b.remindAt.seconds);
  if(!pending.length){const p=document.createElement("p");p.className="work-empty";p.textContent="No reminders yet. Set a reminder time when creating a task.";reminders.append(p);}
  pending.forEach(t=>reminders.append(entry(t,true)));
  dueCheck();
}
function switchView(name){
  view=name;
  for(const id of ["board","list","reminders"])$(id).hidden=id!==name;
  document.querySelectorAll(".tab").forEach(b=>{b.classList.toggle("active",b.dataset.view===name);b.setAttribute("aria-pressed",String(b.dataset.view===name));});
}
function openTask(task=null){
  editing=task;
  $("task-dialog-title").textContent=task?"Edit task":"New task";
  $("task-title").value=task?.title||"";$("task-description").value=task?.description||"";
  $("task-state").value=task?.status||"todo";$("task-priority").value=task?.priority||"medium";
  $("task-due").value=task?.dueDay||"";
  if(task?.remindAt){const d=task.remindAt.toDate();const p=n=>String(n).padStart(2,"0");
    $("task-reminder").value=d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());
  }else $("task-reminder").value="";
  $("task-delete").hidden=!task;err("");$("task-dialog").showModal();$("task-title").focus();
}
function close(){if(!busy)$("task-dialog").close();}
$("new-task").addEventListener("click",()=>openTask());
$("task-cancel").addEventListener("click",close);
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
for(const list of document.querySelectorAll("[data-drop]")){
  list.addEventListener("dragover",e=>{e.preventDefault();e.dataTransfer.dropEffect="move";});
  list.addEventListener("drop",async e=>{
    e.preventDefault();const id=e.dataTransfer.getData("text/plain");
    const task=tasks.find(x=>x.id===id);if(!task||task.status===list.dataset.drop||!user)return;
    try{await updateDoc(doc(db,"taskBoards",user.uid,"items",id),{status:list.dataset.drop,updatedAt:serverTimestamp()});}
    catch(error){feedback(error.message,true);}
  });
}
$("notify-request").addEventListener("click",async()=>{
  if(!("Notification" in window)){feedback("This browser doesn't support notifications.",true);return;}
  if(Notification.permission==="granted"){feedback("Browser alerts already enabled. Keep this page open for reminders.");return;}
  const permission=await Notification.requestPermission();
  feedback(permission==="granted"?"Browser alerts enabled (while this page is open).":"Browser alert permission wasn't granted.");
});
$("task-form").addEventListener("submit",async event=>{
  event.preventDefault();if(busy||!user)return;
  const title=$("task-title").value.trim(),description=$("task-description").value.trim();
  const status=$("task-state").value,priority=$("task-priority").value;
  const dueDay=$("task-due").value,reminderText=$("task-reminder").value;
  if(!title||title.length>120||description.length>1000||!Object.hasOwn(stateLabels,status)||!["low","medium","high"].includes(priority)){err("Please check the task fields.");return;}
  if(dueDay&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDay)){err("Invalid due date.");return;}
  let remindAt=null;
  if(reminderText){
    const date=new Date(reminderText);
    if(!Number.isFinite(date.getTime())){err("Invalid reminder time.");return;}
    remindAt=Timestamp.fromDate(date);
  }
  busy=true;$("task-save").disabled=true;err("");
  const data={title,description,status,priority,dueDay,remindAt,updatedAt:serverTimestamp()};
  try{
    if(editing)await updateDoc(doc(db,"taskBoards",user.uid,"items",editing.id),data);
    else await addDoc(collection(db,"taskBoards",user.uid,"items"),{...data,createdAt:serverTimestamp()});
    recordActivity(db,user.uid,editing?"task_updated":"task_created",title.slice(0,100));
    $("task-dialog").close();feedback(editing?"Task updated.":"Task created.");
  }catch(error){err(error.code==="permission-denied"?"Publish the latest Firestore rules in Firebase Console.":error.message);}
  finally{busy=false;$("task-save").disabled=false;}
});
$("task-delete").addEventListener("click",async()=>{
  if(!editing||busy||!user||!confirm('Delete "'+editing.title+'"?'))return;
  busy=true;try{await deleteDoc(doc(db,"taskBoards",user.uid,"items",editing.id));recordActivity(db,user.uid,"task_deleted",editing.title.slice(0,100));$("task-dialog").close();feedback("Task deleted.");}
  catch(e){err(e.message);}finally{busy=false;}
});
try{
  const client=firebaseClient();db=client.db;
  authenticated(client.auth,u=>{
    if(stopListener)stopListener();user=u;$("new-task").disabled=false;
    stopListener=onSnapshot(query(collection(db,"taskBoards",u.uid,"items"),orderBy("updatedAt","desc"),limit(150)),snap=>{
      tasks=snap.docs.map(d=>({id:d.id,...d.data()}));render();feedback("");
    },error=>feedback(error.code==="permission-denied"?"Publish the latest Firestore rules to use Tasks.":error.message,true));
  });
  setInterval(dueCheck,60000);
}catch(error){feedback(error.message,true);}
