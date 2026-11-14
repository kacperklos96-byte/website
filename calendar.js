// Private calendar for each authenticated Firebase user.
// Dates are stored as YYYY-MM-DD in the user's local calendar, avoiding
// UTC date shifts when rendering month/day views.
import {
  collection, addDoc, deleteDoc, doc, limit, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc, where
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseClient, recordActivity } from "./community-data.js";

const $ = id => document.getElementById(id);
const now = new Date();
let currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
let selectedDay = formatKey(now);
let db = null, uid = null, stopListening = null;
let events = [], loaded = false, editingId = null, busy = false, watchVersion = 0;
const dayNames = new Intl.DateTimeFormat(undefined, {weekday:"long",month:"long",day:"numeric",year:"numeric"});
const monthNames = new Intl.DateTimeFormat(undefined, {month:"long",year:"numeric"});
const shortDates = new Intl.DateTimeFormat(undefined, {weekday:"short",month:"short",day:"numeric"});

function formatKey(date) {
  const y = date.getFullYear();
  return String(y).padStart(4,"0") + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
}
function fromKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return null;
  const [y,m,d] = key.split("-").map(Number);
  const date = new Date(y,m-1,d);
  if (date.getFullYear() !== y || date.getMonth() !== m-1 || date.getDate() !== d) return null;
  return date;
}
function moveDay(date, amount) {
  return new Date(date.getFullYear(),date.getMonth(),date.getDate()+amount);
}
function calendarFirstDay(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay()+6)%7;
  return moveDay(first,-mondayOffset);
}
function calendarLastDay(month) {
  return moveDay(calendarFirstDay(month),41);
}
function dateInRange(day) {
  return day >= formatKey(calendarFirstDay(currentMonth)) &&
    day <= formatKey(calendarLastDay(currentMonth));
}
function compareEvents(a,b) {
  return a.day.localeCompare(b.day)
    || Number(b.allDay)-Number(a.allDay)
    || a.startTime.localeCompare(b.startTime)
    || a.title.localeCompare(b.title);
}
function status(message, kind="") {
  const el = $("calendar-status");
  el.textContent = message;
  el.className = "calendar-feedback" + (kind?" "+kind:"");
}
function dialogError(message) {
  const el = $("event-feedback");
  el.hidden = !message;
  el.textContent = message;
}
function eventTime(event) {
  return event.allDay ? "All day" : event.startTime + "–" + event.endTime;
}
function categoryLabel(category) {
  return ({personal:"Personal",school:"School",work:"Work",other:"Other"})[category] || "Other";
}
function empty(text) {
  const p = document.createElement("p");
  p.className = "calendar-empty";
  p.textContent = text;
  return p;
}
function renderMonth() {
  $("calendar-month").textContent = monthNames.format(currentMonth);
  const inMonth = events.filter(e => e.day.slice(0,7)===formatKey(currentMonth).slice(0,7)).length;
  $("calendar-month-count").textContent = loaded
    ? inMonth + (inMonth===1?" event":" events") : "Loading…";
  const grouped = new Map();
  events.forEach(e => {
    if (!grouped.has(e.day)) grouped.set(e.day,[]);
    grouped.get(e.day).push(e);
  });
  const first = calendarFirstDay(currentMonth);
  const today = formatKey(new Date());
  const grid = $("calendar-grid");
  grid.replaceChildren();
  for(let i=0;i<42;i++){
    const date = moveDay(first,i);
    const key = formatKey(date);
    const items = grouped.get(key)||[];
    const button = document.createElement("button");
    button.type="button";
    button.className = "calendar-day" +
      (date.getMonth()!==currentMonth.getMonth()?" outside":"") +
      (key===selectedDay?" selected":"") +
      (key===today?" today":"");
    button.setAttribute("aria-label", dayNames.format(date) + ", " + items.length + (items.length===1?" event":" events"));
    button.setAttribute("aria-pressed",String(key===selectedDay));
    const num=document.createElement("span"); num.className="day-number"; num.textContent=date.getDate();
    button.append(num);
    const chipBox=document.createElement("div");chipBox.className="day-events-preview";
    items.slice(0,2).forEach(e => {
      const chip=document.createElement("span");chip.className="day-chip";
      chip.dataset.category=e.category;
      chip.textContent=e.title;
      chip.title=e.title + " ("+eventTime(e)+")";
      chipBox.append(chip);
    });
    if(items.length>2){
      const more=document.createElement("span");more.className="day-more";
      more.textContent="+"+(items.length-2)+" more";
      chipBox.append(more);
    }
    button.append(chipBox);
    button.addEventListener("click",()=>{
      selectedDay=key;
      if(date.getMonth()!==currentMonth.getMonth()||date.getFullYear()!==currentMonth.getFullYear()){
        currentMonth=new Date(date.getFullYear(),date.getMonth(),1);
        watchMonth();
      } else renderAll();
    });
    grid.append(button);
  }
}
function sidebarEntry(event, upcoming=false) {
  const row=document.createElement("div");row.className="side-event";
  const marker=document.createElement("span");marker.className="side-event-marker";
  marker.dataset.category=event.category;
  const detail=document.createElement("div");detail.className="side-event-content";
  if(upcoming){
    const date=document.createElement("div");date.className="upcoming-day";
    const parsed=fromKey(event.day);
    date.textContent=parsed ? shortDates.format(parsed) : event.day;
    detail.append(date);
  }
  const title=document.createElement("div");title.className="side-event-title";title.textContent=event.title;
  const time=document.createElement("div");time.className="side-event-time";
  time.textContent=eventTime(event)+" · "+categoryLabel(event.category);
  detail.append(title,time);
  if(event.location){
    const location=document.createElement("div");location.className="side-event-location";
    location.textContent=event.location;detail.append(location);
  }
  const edit=document.createElement("button");edit.type="button";edit.className="side-event-edit";
  edit.title="Edit "+event.title;edit.setAttribute("aria-label","Edit "+event.title);
  const icon=document.createElement("i");icon.className="fas fa-pen";icon.setAttribute("aria-hidden","true");
  edit.append(icon);
  edit.addEventListener("click",()=>openEditor(event.day,event));
  row.append(marker,detail,edit);
  return row;
}
function renderSide() {
  const parsed=fromKey(selectedDay);
  $("day-heading").textContent=parsed
    ? new Intl.DateTimeFormat(undefined,{weekday:"long",month:"short",day:"numeric"}).format(parsed)
    : selectedDay;
  const items=events.filter(e=>e.day===selectedDay);
  const list=$("day-events");list.replaceChildren();
  if(!loaded)list.append(empty("Loading your plans…"));
  else if(!items.length)list.append(empty("Nothing planned. An excellent day to do absolutely nothing."));
  else items.forEach(e=>list.append(sidebarEntry(e)));
  const upcoming=$("calendar-upcoming");upcoming.replaceChildren();
  const startKey = formatKey(new Date()) > formatKey(calendarFirstDay(currentMonth))
    ? formatKey(new Date()) : formatKey(calendarFirstDay(currentMonth));
  const future=events.filter(e=>e.day>=startKey).slice(0,8);
  if(!loaded)upcoming.append(empty("Loading your events…"));
  else if(!future.length)upcoming.append(empty("No upcoming events in these calendar weeks."));
  else future.forEach(e=>upcoming.append(sidebarEntry(e,true)));
}
function renderAll() {
  events.sort(compareEvents);
  renderMonth();
  renderSide();
  $("calendar-export").disabled=!loaded||!events.length;
}
function watchMonth() {
  renderAll();
  if(stopListening){stopListening();stopListening=null;}
  if(!db||!uid)return;
  loaded=false;
  events=[];
  renderAll();
  const thisWatch=++watchVersion;
  const start=formatKey(calendarFirstDay(currentMonth));
  const end=formatKey(calendarLastDay(currentMonth));
  const q=query(
    collection(db,"calendars",uid,"events"),
    where("day",">=",start),where("day","<=",end),
    orderBy("day","asc"),limit(250)
  );
  status("Loading your private calendar…");
  stopListening=onSnapshot(q,snap=>{
    if(thisWatch!==watchVersion)return;
    events=snap.docs.map(d=>({id:d.id,...d.data()}));
    loaded=true;
    renderAll();
    status(snap.size>=250
      ? "Showing the first 250 events in these weeks. Move or remove events to see others."
      : "");
    $("calendar-add").disabled=false;
    $("day-add").disabled=false;
  },error=>{
    if(thisWatch!==watchVersion)return;
    console.error("Calendar Firestore error:",error);
    events=[];loaded=false;renderAll();
    status(error.code==="permission-denied"
      ? "Calendar access denied. Publish the latest firestore.rules in Firebase Console."
      : "Couldn't load calendar events. Check your connection and try changing months.","error");
    $("calendar-add").disabled=false;
    $("day-add").disabled=false;
  });
}
function syncAllDay() {
  const allDay=$("event-all-day").checked;
  $("event-time-fields").hidden=allDay;
  for(const id of ["event-start","event-end"]){
    $(id).disabled=allDay;$(id).required=!allDay;
  }
}
function openEditor(day,record=null) {
  if(!uid){status("Please log in to create events.","error");return;}
  editingId=record?.id||null;
  $("event-dialog-title").textContent=record?"Edit event":"New event";
  $("event-title").value=record?.title||"";
  $("event-day").value=record?.day||day||formatKey(new Date());
  $("event-category").value=record?.category||"personal";
  $("event-all-day").checked=record?.allDay??true;
  $("event-start").value=record?.startTime||"09:00";
  $("event-end").value=record?.endTime||"10:00";
  $("event-location").value=record?.location||"";
  $("event-description").value=record?.description||"";
  $("description-count").textContent=$("event-description").value.length;
  $("event-delete").hidden=!record;
  $("event-save").disabled=false;
  dialogError("");
  syncAllDay();
  $("event-dialog").showModal();
  $("event-title").focus();
}
function closeEditor(){
  if(busy)return;
  $("event-dialog").close();
  editingId=null;
}
function valuesFromEditor() {
  const title=$("event-title").value.trim();
  const day=$("event-day").value;
  const allDay=$("event-all-day").checked;
  const startTime=allDay?"":$("event-start").value;
  const endTime=allDay?"":$("event-end").value;
  const category=$("event-category").value;
  const location=$("event-location").value.trim();
  const description=$("event-description").value.trim();
  const date=fromKey(day);
  if(!title||title.length>90)throw Error("Please enter an event title (max 90 characters).");
  if(!date||date.getFullYear()<1900||date.getFullYear()>2100)
    throw Error("Please choose a valid date between 1900 and 2100.");
  if(!["personal","school","work","other"].includes(category))throw Error("Choose a valid category.");
  if(!allDay && (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) ||
    !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(endTime) || endTime<=startTime))
    throw Error("The end time must be after the start time.");
  if(location.length>120||description.length>1000)throw Error("Your location or notes are too long.");
  return {title,day,allDay,startTime,endTime,category,location,description};
}
function saveError(error) {
  return error?.code==="permission-denied"
    ? "Permission denied. Publish the updated Firestore rules before saving events."
    : error?.code==="unavailable"
      ? "Firestore is offline. Please retry when your connection returns."
      : (error?.message||"Unable to save this event.");
}
async function saveFromForm(e){
  e.preventDefault();
  if(busy||!uid)return;
  let values;
  try{values=valuesFromEditor();}catch(error){dialogError(error.message);return;}
  busy=true;$("event-save").disabled=true;$("event-delete").disabled=true;dialogError("");
  const wasEditing=!!editingId;
  try{
    const base=collection(db,"calendars",uid,"events");
    if(wasEditing){
      await updateDoc(doc(base,editingId),{...values,updatedAt:serverTimestamp()});
    }else{
      await addDoc(base,{...values,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    }
    // These activity markers are client-written and not trusted audit data.
    recordActivity(db,uid,wasEditing?"calendar_updated":"calendar_created",
      (wasEditing?"Edited: ":"Created: ")+values.title.slice(0,100));
    $("event-dialog").close();
    editingId=null;
    selectedDay=values.day;
    const date=fromKey(values.day);
    if(!dateInRange(values.day)){
      currentMonth=new Date(date.getFullYear(),date.getMonth(),1);
      watchMonth();
    }else renderAll();
    status(wasEditing?"Event updated.":"Event added.","success");
  }catch(error){
    console.error("Couldn't save event:",error);
    dialogError(saveError(error));
  }finally{busy=false;$("event-save").disabled=false;$("event-delete").disabled=false;}
}
async function deleteFromEditor() {
  if(!editingId||busy||!uid)return;
  const target=events.find(e=>e.id===editingId);
  if(!target)return;
  if(!window.confirm('Delete "'+target.title+'" from your calendar?'))return;
  busy=true;$("event-save").disabled=true;$("event-delete").disabled=true;dialogError("");
  try{
    await deleteDoc(doc(db,"calendars",uid,"events",editingId));
    recordActivity(db,uid,"calendar_deleted","Deleted: "+target.title.slice(0,100));
    $("event-dialog").close();
    editingId=null;
    status("Event deleted.","success");
  }catch(error){console.error(error);dialogError(saveError(error));}
  finally{busy=false;$("event-save").disabled=false;$("event-delete").disabled=false;}
}
function icsEscape(value){
  return String(value||"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n")
    .replace(/,/g,"\\,").replace(/;/g,"\\;");
}
function utcStamp(date){
  const pad=n=>String(n).padStart(2,"0");
  return date.getUTCFullYear()+pad(date.getUTCMonth()+1)+pad(date.getUTCDate())+"T"+
    pad(date.getUTCHours())+pad(date.getUTCMinutes())+pad(date.getUTCSeconds())+"Z";
}
function exportICS(){
  if(!events.length)return;
  const stamp=utcStamp(new Date());
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//My Website//Private Calendar//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  for(const item of events){
    const day=item.day.replaceAll("-","");
    const start=item.allDay?day:day+"T"+item.startTime.replace(":","")+"00";
    const next=fromKey(item.day);
    const end=item.allDay?formatKey(moveDay(next,1)).replaceAll("-",""):day+"T"+item.endTime.replace(":","")+"00";
    lines.push("BEGIN:VEVENT","UID:"+icsEscape(item.id)+"@my-website",
      "DTSTAMP:"+stamp,
      item.allDay?"DTSTART;VALUE=DATE:"+start:"DTSTART:"+start,
      item.allDay?"DTEND;VALUE=DATE:"+end:"DTEND:"+end,
      "SUMMARY:"+icsEscape(item.title),
      "DESCRIPTION:"+icsEscape(item.description),
      "LOCATION:"+icsEscape(item.location),
      "CATEGORIES:"+item.category.toUpperCase(),
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob=new Blob([lines.join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="my-website-calendar-"+formatKey(currentMonth).slice(0,7)+".ics";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  status("Calendar events exported. Times use local time in your calendar app.","success");
}

$("calendar-prev").addEventListener("click",()=>{
  currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);
  selectedDay=formatKey(currentMonth);watchMonth();
});
$("calendar-next").addEventListener("click",()=>{
  currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);
  selectedDay=formatKey(currentMonth);watchMonth();
});
$("calendar-today").addEventListener("click",()=>{
  const today=new Date();
  currentMonth=new Date(today.getFullYear(),today.getMonth(),1);
  selectedDay=formatKey(today);watchMonth();
});
$("calendar-add").addEventListener("click",()=>openEditor(selectedDay));
$("day-add").addEventListener("click",()=>openEditor(selectedDay));
$("event-all-day").addEventListener("change",syncAllDay);
$("event-description").addEventListener("input",()=>{
  $("description-count").textContent=$("event-description").value.length;
});
$("event-form").addEventListener("submit",saveFromForm);
$("event-delete").addEventListener("click",deleteFromEditor);
$("event-close").addEventListener("click",closeEditor);
$("event-cancel").addEventListener("click",closeEditor);
$("event-dialog").addEventListener("cancel",e=>{if(busy)e.preventDefault();});
$("calendar-export").addEventListener("click",exportICS);

renderAll();
try{
  const client=firebaseClient();db=client.db;
  onAuthStateChanged(client.auth,user=>{
    if(!user){location.replace("login.html");return;}
    if(uid&&uid!==user.uid&&stopListening){stopListening();stopListening=null;}
    uid=user.uid;
    $("calendar-add").disabled=false;$("day-add").disabled=false;
    watchMonth();
  },error=>{
    console.error("Calendar authentication failed:",error);
    status("Couldn't verify your login. Reload to try again.","error");
  });
}catch(error){console.error(error);status(error.message||"Firebase is unavailable.","error");}
