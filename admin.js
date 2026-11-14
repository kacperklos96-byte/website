import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { authenticated, firebaseClient, when } from "./community-data.js";
import { renderAvatar } from "./avatar.js?v=mascot-1";

const $=id=>document.getElementById(id);
let db,auth,adminUser,accounts=[],busy=false;
function status(text,error=false) {
  $("page-status").textContent=text;
  $("page-status").className="community-state"+(error?" error":"");
}
function feedback(text,error=false) {
  $("admin-feedback").textContent=text;
  $("admin-feedback").className="community-state"+(error?" error":"");
}
async function selectAccount(uid) {
  if(!accounts.some(a=>a.id===uid))return;
  $("review-uid").value=uid;
  $("review-status").value="clear";$("review-note").value="";
  feedback("Loading any previous review…");
  try{
    const s=await getDoc(doc(db,"adminReviews",uid));
    if(s.exists()){
      $("review-status").value=s.data().status || "clear";
      $("review-note").value=s.data().note || "";
    }
    feedback("Review loaded. Edit and save when ready.");
  }catch(error){feedback("Couldn't load that user's review.",true);console.error(error);}
}
function renderAccount(entry) {
  const d=entry.data;
  const row=document.createElement("div");row.className="admin-user-row";
  const avatar=document.createElement("div");avatar.className="community-avatar small";
  renderAvatar(avatar,d);
  const info=document.createElement("div");info.className="member-text";
  const name=document.createElement("p");name.className="member-title";
  name.textContent=d.displayName||"Member";
  const email=document.createElement("p");email.className="member-description";
  email.textContent=d.email||"No email";
  const id=document.createElement("p");id.className="member-description";
  id.textContent="UID: "+entry.id+" · Joined "+when(d.createdAt);
  info.append(name,email,id);
  const controls=document.createElement("div");controls.className="member-actions";
  const select=document.createElement("button");select.type="button";select.className="community-button";
  select.textContent="Review";select.addEventListener("click",()=>selectAccount(entry.id));
  controls.append(select);row.append(avatar,info,controls);
  return row;
}
async function loadRoster(){
  status("Loading admin data…");
  try{
    const [users,publics,reviews]=await Promise.all([
      getDocs(query(collection(db,"users"),limit(25))),
      getDocs(query(collection(db,"publicProfiles"),limit(15))),
      getDocs(query(collection(db,"adminReviews"),limit(25)))
    ]);
    accounts=users.docs.map(s=>({id:s.id,data:s.data()}))
      .sort((a,b)=>(b.data.createdAt?.toMillis?.()||0)-(a.data.createdAt?.toMillis?.()||0));
    $("admin-users-count").textContent=String(users.size);
    $("admin-public-count").textContent=String(publics.size);
    $("admin-reviewed-count").textContent=String(reviews.size);
    const parent=$("admin-users");parent.replaceChildren();
    if(!accounts.length){const p=document.createElement("p");p.className="community-blank";p.textContent="No account records found.";parent.append(p);}
    accounts.forEach(a=>parent.append(renderAccount(a)));
    status("");
  }catch(error){
    status(error.code==="permission-denied"
      ? "Access denied by Firestore. Check the published rules and your Firebase admin custom claim."
      : "Couldn't load administrator data.",true);
    console.error(error);
  }
}
$("reload-admin").addEventListener("click",loadRoster);
$("admin-review-form").addEventListener("submit",async e=>{
  e.preventDefault();if(busy||!adminUser)return;
  const uid=$("review-uid").value;
  if(!accounts.some(a=>a.id===uid)){feedback("Select an account from the list first.",true);return;}
  const note=$("review-note").value.trim();
  const reviewStatus=$("review-status").value;
  if(note.length>300||!["clear","reviewed","flagged"].includes(reviewStatus)){
    feedback("Invalid review details.",true);return;
  }
  busy=true;$("save-review").disabled=true;feedback("Saving private review…");
  try{
    await setDoc(doc(db,"adminReviews",uid),{
      status:reviewStatus,note,updatedBy:adminUser.uid,updatedAt:serverTimestamp()
    });
    feedback("Review saved. This does not ban or suspend the account.");
    await loadRoster();
  }catch(error){
    feedback(error.code==="permission-denied"
      ? "Permission denied. Admin roles must be assigned with the trusted Firebase Admin SDK, and Firestore rules must be published."
      : (error.message||"Couldn't save the review."),true);
  }finally{busy=false;$("save-review").disabled=false;}
});
try{
  const client=firebaseClient(); db=client.db;auth=client.auth;
  authenticated(auth,async u=>{
    try{
      // Force-refresh a token to check the server-issued role, not a client flag.
      const token=await u.getIdTokenResult(true);
      if(token.claims.admin!==true){
        const staffRole=String(token.claims.staffRole||"");
        if(["moderator","support"].includes(staffRole)){
          status("Staff role verified. The reports and support queues are available below; account rosters require administrator access.");
        } else {
          status("This page is restricted to verified staff. Ask the owner to grant a role using the trusted Firebase Admin SDK.",true);
        }
        return;
      }
      adminUser=u;
      $("admin-content").hidden=false;
      await loadRoster();
    }catch(error){
      status("Unable to verify administrator permissions. Reload your account.",true);
      console.error(error);
    }
  });
}catch(error){status(error.message,true);}
