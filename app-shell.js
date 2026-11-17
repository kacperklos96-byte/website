// Minimal shared navigation. No backend permissions are decided by this UI.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseClient } from "./community-data.js";

const pages = new Set([
  "dashboard","messages","tasks","calendar","search","notifications",
  "activity","profile-editor","public-profile","settings","support","admin"
]);
const current = document.body?.dataset.page;
if (pages.has(current)) renderNavigation();

function renderNavigation() {
  const nav = document.querySelector("body > header nav");
  if (!nav || nav.querySelector(".ws-primary")) return;
  document.body.classList.add("workspace-layout");
  const logo = nav.querySelector(".logo");
  if (logo) logo.href = "dashboard.html";

  const mainLinks = [
    ["dashboard","Overview","dashboard.html"],
    ["messages","Community","messages.html"],
    ["tasks","Tasks","tasks.html"],
    ["calendar","Calendar","calendar.html"]
  ];
  const moreLinks = [
    ["search","Find people","search.html"],
    ["activity","Activity","activity.html"],
    ["profile-editor","Profile","profile.html"],
    ["settings","Settings","settings.html"],
    ["support","Support","support.html"]
  ];
  const selected = id => id === current || (
    id === "profile-editor" && current === "public-profile"
  );
  const makeLink = ([id,label,url]) => {
    const link=document.createElement("a");
    link.href=url;link.textContent=label;
    link.className="ws-nav-link"+(selected(id)?" active":"");
    if(selected(id)) link.setAttribute("aria-current","page");
    return link;
  };

  const primary=document.createElement("div");
  primary.className="ws-primary";
  mainLinks.forEach(spec=>primary.append(makeLink(spec)));
  const more=document.createElement("details");
  more.className="ws-more";
  const summary=document.createElement("summary");
  summary.textContent="More";summary.setAttribute("aria-label","More pages");
  const dropdown=document.createElement("div");
  dropdown.className="ws-dropdown";
  moreLinks.forEach(spec=>dropdown.append(makeLink(spec)));
  const admin=makeLink(["admin","Administration","admin.html"]);
  admin.hidden=true;admin.classList.add("ws-staff-link");
  dropdown.append(admin);
  more.append(summary,dropdown);
  if(moreLinks.some(([id])=>selected(id))||current==="admin")more.classList.add("contains-current");
  primary.append(more);

  const mobileToggle=document.createElement("button");
  mobileToggle.className="ws-menu-toggle";
  mobileToggle.type="button";
  mobileToggle.setAttribute("aria-controls","ws-mobile-menu");
  mobileToggle.setAttribute("aria-expanded","false");
  mobileToggle.setAttribute("aria-label","Open navigation");
  const mobileIcon=document.createElement("i");
  mobileIcon.className="fas fa-bars";mobileIcon.setAttribute("aria-hidden","true");
  mobileToggle.append(mobileIcon);
  const mobile=document.createElement("div");
  mobile.id="ws-mobile-menu";mobile.className="ws-mobile-menu";mobile.hidden=true;
  [...mainLinks,...moreLinks].forEach(spec=>mobile.append(makeLink(spec)));
  const mobileAdmin=makeLink(["admin","Administration","admin.html"]);
  mobileAdmin.hidden=true;mobileAdmin.classList.add("ws-staff-link");
  mobile.append(mobileAdmin);

  nav.insertBefore(mobileToggle,logo||nav.firstChild);
  nav.insertBefore(primary,nav.querySelector(".nav-links")||null);
  nav.append(mobile);
  const close=()=>{
    mobile.hidden=true;
    mobileToggle.setAttribute("aria-expanded","false");
    mobileToggle.setAttribute("aria-label","Open navigation");
    mobileIcon.className="fas fa-bars";
  };
  mobileToggle.addEventListener("click",()=>{
    const isOpen=mobile.hidden;
    mobile.hidden=!isOpen;
    mobileToggle.setAttribute("aria-expanded",String(isOpen));
    mobileToggle.setAttribute("aria-label",isOpen?"Close navigation":"Open navigation");
    mobileIcon.className=isOpen?"fas fa-times":"fas fa-bars";
    if(isOpen)more.open=false;
  });
  mobile.addEventListener("click",event=>{if(event.target.closest("a"))close();});
  document.addEventListener("click",event=>{
    if(!more.contains(event.target)) more.open=false;
    if(!nav.contains(event.target)) close();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape") {more.open=false;close();mobileToggle.focus();}
  });
  window.addEventListener("resize",()=>{
    if(window.innerWidth>720)close();
  });

  const applyStaff=visible=>{
    document.querySelectorAll(".ws-staff-link").forEach(link=>{link.hidden=!visible;});
  };
  try {
    const {auth}=firebaseClient();
    onAuthStateChanged(auth,async user=>{
      if(!user){applyStaff(false);return;}
      try {
        const result=await user.getIdTokenResult();
        if(auth.currentUser?.uid!==user.uid)return;
        const role=String(result.claims.staffRole||"");
        applyStaff(result.claims.admin===true ||
          ["owner","admin","moderator","support"].includes(role));
      }catch(error){console.warn("Navigation role unavailable",error);applyStaff(false);}
    });
  }catch(error){console.warn("Unable to load staff navigation",error);}
  window.dispatchEvent(new Event("workspace-layout-ready"));
}
