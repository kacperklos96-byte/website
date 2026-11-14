// Trusted operator-only tool: run LOCALLY, never in GitHub Pages.
// npm.cmd install --no-save firebase-admin
// Set GOOGLE_APPLICATION_CREDENTIALS to your private service-account JSON.
// Examples:
// node scripts/admin-tools.mjs role <uid> owner|admin|moderator|support|none
// node scripts/admin-tools.mjs suspend <uid> "Repeated abuse"
// node scripts/admin-tools.mjs unsuspend <uid>
// node scripts/admin-tools.mjs revoke-sessions <uid>
import {applicationDefault,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";

const [action,uid,argument]=process.argv.slice(2);
const actions=["role","suspend","unsuspend","revoke-sessions"];
if(!actions.includes(action)||!/^[A-Za-z0-9_-]{6,128}$/.test(uid||"")){
 console.error("Usage: node scripts/admin-tools.mjs role|suspend|unsuspend|revoke-sessions <Firebase-UID> [role|reason]");
 process.exit(1);
}
if(!process.env.GOOGLE_APPLICATION_CREDENTIALS){
 console.error("Set GOOGLE_APPLICATION_CREDENTIALS to your PRIVATE service-account JSON outside the repository.");
 process.exit(1);
}
if(action==="role"&&!["owner","admin","moderator","support","none"].includes(argument)){
 console.error("Roles: owner, admin, moderator, support, none");process.exit(1);
}
initializeApp({credential:applicationDefault()});
const auth=getAuth(),db=getFirestore();
const target=await auth.getUser(uid);
const operator=process.env.ADMIN_OPERATOR_UID||"trusted-local-admin";
let details="";
switch(action){
 case "role": {
  const old=target.customClaims||{};
  await auth.setCustomUserClaims(uid,{
   ...old,staffRole:argument==="none"?"":argument,admin:argument==="owner"||argument==="admin"
  });
  await auth.revokeRefreshTokens(uid);
  details="Changed staff role to "+argument+"; revoked refresh tokens";
  break;
 }
 case "suspend":{
  await auth.updateUser(uid,{disabled:true});
  await auth.revokeRefreshTokens(uid);
  const reason=String(argument||"Suspended by administrator").slice(0,300);
  await db.collection("userModeration").doc(uid).set({
    disabled:true,reason,updatedBy:operator,updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
  details="Suspended account and revoked refresh tokens: "+reason;
  break;
 }
 case "unsuspend":{
  await auth.updateUser(uid,{disabled:false});
  await auth.revokeRefreshTokens(uid);
  await db.collection("userModeration").doc(uid).set({
   disabled:false,reason:"",updatedBy:operator,updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
  details="Unsuspended account; user must sign in again";
  break;
 }
 case "revoke-sessions":{
  await auth.revokeRefreshTokens(uid);
  details="Revoked all refresh tokens; currently issued ID tokens can remain valid until expiry";
  break;
 }
}
try{
 await db.collection("adminAudit").add({
  action,targetUid:uid,operator,details,createdAt:FieldValue.serverTimestamp()
 });
}catch(error){
 console.error("ACTION COMPLETED but audit logging FAILED. Record this incident manually:",error);
 process.exit(2);
}
console.log("SUCCESS: "+details);
console.log("Note: Firebase ID tokens may remain valid until their expiry even after token revocation.");
