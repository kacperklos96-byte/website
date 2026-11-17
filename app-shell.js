// Shared authenticated workspace navigation. Presentation only — never grants access.
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseClient } from "./community-data.js";

const pages = {
  dashboard:["Overview","layout-dashboard"],
  calendar:["Calendar","calendar-days"],
  tasks:["Tasks & boards","list-checks"],
  messages:["Community","message-circle"],
  search:["Discover people","search"],
  notifications:["Notifications","bell"],
  activity:["Activity","history"],
  profile:["Your profile","user-round"],
  "public-profile":["Member profile","user-round"],
  settings:["Settings","sliders-horizontal"],
  admin:["Administration","shield"],
  support:["Support center","life-buoy"]
};
const page = document.body?.dataset.page;
if (page && Object.prototype.hasOwnProperty.call(pages,page)) {
  buildWorkspace();
}
function buildWorkspace() {
  if (document.querySelector(".workspace-sidebar")) return;
  document.body.classList.add("workspace-layout");
  const header = document.querySelector("body > header");
  const nav = header?.querySelector("nav");
  if (!header || !nav) return;

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "workspace-menu-toggle";
  openButton.setAttribute("aria-label","Open navigation menu");
  openButton.setAttribute("aria-controls","workspace-sidebar");
  openButton.setAttribute("aria-expanded","false");
  const lines = document.createElement("i");
  lines.className="fas fa-bars";lines.setAttribute("aria-hidden","true");
  openButton.append(lines);

  const title = document.createElement("div");
  title.className = "workspace-page-title";
  const icon = document.createElement("i");
  icon.className="fas fa-"+iconFor(page);icon.setAttribute("aria-hidden","true");
  const span = document.createElement("span");
  span.textContent = pages[page][0];
  title.append(icon,span);

  nav.insertBefore(openButton, nav.firstChild);
  nav.insertBefore(title, nav.querySelector(".nav-links") || null);
  const shade = document.createElement("button");
  shade.type="button";shade.className="workspace-sidebar-shade";
  shade.setAttribute("aria-label","Close navigation menu");
  shade.setAttribute("tabindex","-1");

  const side = document.createElement("aside");
  side.id="workspace-sidebar";
  side.className="workspace-sidebar";
  side.setAttribute("aria-label","Workspace navigation");

  const brand = document.createElement("a");
  brand.className="workspace-brand";
  brand.href="dashboard.html";
  const mark = document.createElement("span");
  mark.className="workspace-brand-mark";
  const markIcon=document.createElement("i");
  markIcon.className="fas fa-layer-group";markIcon.setAttribute("aria-hidden","true");
  mark.append(markIcon);
  const brandText=document.createElement("span");
  brandText.className="workspace-brand-copy";
  const brandName=document.createElement("strong");brandName.textContent="My Website";
  const brandDesc=document.createElement("small");brandDesc.textContent="PERSONAL WORKSPACE";
  brandText.append(brandName,brandDesc);brand.append(mark,brandText);side.append(brand);

  const sections = [
    ["WORKSPACE",[
      ["dashboard","dashboard.html","Overview","fa-th-large"],
      ["tasks","tasks.html","Tasks & boards","fa-check-square"],
      ["calendar","calendar.html","Calendar","fa-calendar-alt"]
    ]],
    ["CONNECT",[
      ["messages","messages.html","Community","fa-comments"],
      ["search","search.html","Find people","fa-user-friends"],
      ["notifications","notifications.html","Notifications","fa-bell"]
    ]],
    ["YOUR ACCOUNT",[
      ["profile","profile.html","Profile","fa-user-circle"],
      ["activity","activity.html","Activity history","fa-history"],
      ["settings","settings.html","Settings","fa-cog"]
    ]],
    ["HELP",[
      ["support","support.html","Help & support","fa-life-ring"]
    ]]
  ];
  const scroll = document.createElement("div");
  scroll.className = "workspace-nav-scroll";
  for (const [heading,links] of sections) {
    const section = document.createElement("section");
    section.className="workspace-nav-group";
    const headingEl = document.createElement("p");
    headingEl.className="workspace-nav-label";headingEl.textContent=heading;
    section.append(headingEl);
    for (const [id,href,label,fa] of links) {
      const link=document.createElement("a");
      link.className="workspace-nav-item";
      link.href=href;
      link.dataset.feature=id;
      if(id===page || (id==="profile"&&page==="public-profile")){
        link.classList.add("is-active");
        link.setAttribute("aria-current","page");
      }
      const glyph=document.createElement("i");
      glyph.className="fas "+fa;glyph.setAttribute("aria-hidden","true");
      const text=document.createElement("span");
      text.textContent=label;
      link.append(glyph,text);
      section.append(link);
    }
    scroll.append(section);
  }
  const staffSection=document.createElement("section");
  staffSection.className="workspace-nav-group";
  staffSection.hidden=true;
  const sh=document.createElement("p");sh.className="workspace-nav-label";sh.textContent="STAFF";
  const staffLink=document.createElement("a");
  staffLink.className="workspace-nav-item"+(page==="admin"?" is-active":"");
  staffLink.href="admin.html";
  staffLink.dataset.feature="admin";
  if(page==="admin")staffLink.setAttribute("aria-current","page");
  const shield=document.createElement("i");shield.className="fas fa-shield-alt";shield.setAttribute("aria-hidden","true");
  const staffText=document.createElement("span");staffText.textContent="Administration";
  staffLink.append(shield,staffText);
  staffSection.append(sh,staffLink);scroll.append(staffSection);
  side.append(scroll);

  const footer = document.createElement("div");
  footer.className = "workspace-sidebar-bottom";
  const statusDot=document.createElement("span");statusDot.className="workspace-private-dot";statusDot.setAttribute("aria-hidden","true");
  const bottomText=document.createElement("div");
  const privateHeading=document.createElement("strong");privateHeading.textContent="Your space";
  const privateDetails=document.createElement("span");privateDetails.textContent="Made for your everyday stuff";
  bottomText.append(privateHeading,privateDetails);footer.append(statusDot,bottomText);
  side.append(footer);

  header.insertAdjacentElement("afterend",side);
  side.insertAdjacentElement("afterend",shade);

  function closeMenu(){
    document.body.classList.remove("workspace-menu-open");
    openButton.setAttribute("aria-expanded","false");
    openButton.setAttribute("aria-label","Open navigation menu");
  }
  openButton.addEventListener("click",()=>{
    const active=document.body.classList.toggle("workspace-menu-open");
    openButton.setAttribute("aria-expanded",String(active));
    openButton.setAttribute("aria-label",active?"Close navigation menu":"Open navigation menu");
    if(active){const first=side.querySelector(".workspace-nav-item.is-active")||side.querySelector(".workspace-nav-item");first?.focus();}
  });
  shade.addEventListener("click",closeMenu);
  side.addEventListener("click",e=>{if(e.target.closest("a"))closeMenu();});
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&document.body.classList.contains("workspace-menu-open")){
      closeMenu();openButton.focus();
    }
  });
  const mql=window.matchMedia("(min-width: 981px)");
  mql.addEventListener("change",e=>{if(e.matches)closeMenu();});

  try{
    const client=firebaseClient();
    onAuthStateChanged(client.auth, async user=>{
      staffSection.hidden=true;
      if(!user)return;
      try {
        const token=await user.getIdTokenResult();
        const role=String(token.claims.staffRole||"");
        if(client.auth.currentUser?.uid===user.uid)staffSection.hidden=!(
          token.claims.admin===true || ["owner","admin","moderator","support"].includes(role)
        );
      }catch(error){console.warn("Couldn't check staff navigation status:",error);}
    });
  }catch(error){console.warn("Workspace staff navigation unavailable:",error);}

  window.dispatchEvent(new Event("workspace-layout-ready"));
}
function iconFor(id){
  const icons={dashboard:"th-large",calendar:"calendar-alt",tasks:"tasks",messages:"comments",
    search:"user-friends",notifications:"bell",activity:"history",profile:"user-circle",
    "public-profile":"user-circle",settings:"cog",admin:"shield-alt",support:"life-ring"};
  return icons[id]||"th-large";
}
