const VEXA_LOCAL = window.VEXA_VIDEOS || [];
const PAGE_SIZE = 30;
let allVideos = [];
let currentPage = 1;
let currentList = [];

document.addEventListener("DOMContentLoaded", async () => {
  setupTheme(); setupMenu(); setupSearch();
  if (document.getElementById("tagCloud")) { await loadTags(); return; }
  if (document.getElementById("creatorPage")) { await renderCreatorPage(); return; }
  if (document.getElementById("videoPage")) { await renderVideoPage(); return; }
  if (document.getElementById("videoGrid")) await loadListing();
});

function setupTheme(){
  const saved=localStorage.getItem("vexa-theme");
  document.documentElement.classList.toggle("light",saved==="light");
  const b=document.getElementById("themeBtn");
  if(b)b.onclick=()=>{const light=!document.documentElement.classList.contains("light");document.documentElement.classList.toggle("light",light);localStorage.setItem("vexa-theme",light?"light":"dark");};
}
function setupMenu(){
  const b=document.getElementById("menuBtn"), o=document.getElementById("overlay");
  if(b)b.onclick=()=>document.body.classList.toggle("menu-open");
  if(o)o.onclick=()=>document.body.classList.remove("menu-open");
  document.querySelectorAll(".sidebar a").forEach(a=>a.addEventListener("click",()=>document.body.classList.remove("menu-open")));
}
function setupSearch(){
  const i=document.getElementById("searchInput"); if(!i)return;
  i.addEventListener("input",()=>{
    const q=i.value.toLowerCase().trim();
    if(document.getElementById("tagCloud")){document.querySelectorAll(".tag-link").forEach(a=>a.hidden=q && !a.textContent.toLowerCase().includes(q));return;}
    if(!allVideos.length)return;
    currentPage=1; renderGrid(q?allVideos.filter(v=>(v.title+" "+(v.category||"")+" "+(v.tags||[]).join(" ")).toLowerCase().includes(q)):allVideos);
  });
}
async function loadListing(){
  allVideos=VEXA_LOCAL;
  if(window.supabaseClient){
    const {data,error}=await window.supabaseClient.from("vexa_published_videos").select("*").limit(300);
    if(!error && data?.length) allVideos=data.map(normalizeVideo);
  }
  renderGrid(allVideos);
}
function normalizeVideo(v){return {...v,thumbnail:v.thumbnail_url||v.thumbnail||"https://placehold.co/640x360/111/fff?text=Vexa",video:v.video_url||v.video,preview:v.preview_url||v.preview,download:v.video_url||v.download,category:v.category||"Video",tags:Array.isArray(v.tags)?v.tags:[],uploader_id:v.uploader_id||v.user_id||v.created_by, uploader_name:v.uploader_name||v.creator_name||v.username||"Vexa Creator"};}
function renderGrid(list=allVideos){
  currentList=list; const grid=document.getElementById("videoGrid"); if(!grid)return;
  const total=Math.max(1,Math.ceil(list.length/PAGE_SIZE)); currentPage=Math.min(currentPage,total); const start=(currentPage-1)*PAGE_SIZE;
  grid.innerHTML=list.slice(start,start+PAGE_SIZE).map(createCard).join("") || `<p class="muted">No videos found.</p>`;
  setupPreviews(); renderPagination(total);
}
function createCard(v){
  const x=normalizeVideo(v);
  return `<article class="card video-card" data-id="${esc(x.id)}"><a class="video-link" href="video.html?id=${encodeURIComponent(x.id)}"><div class="thumb preview-wrap"><img class="thumb-img" src="${esc(x.thumbnail)}" alt="" loading="lazy">${x.preview?`<video class="preview-video" muted playsinline preload="none" src="${esc(x.preview)}"></video>`:""}<span class="play">▶</span></div><div class="card-body"><h3>${esc(x.title)}</h3><div class="card-meta">${formatViews(x.views||0)} views · ${esc(x.category||"Video")}</div></div></a></article>`;
}
function setupPreviews(){
  document.querySelectorAll(".video-card").forEach(card=>{
    const video=card.querySelector(".preview-video"); if(!video)return;
    let timer=null,previewing=false;
    const start=()=>{clearTimeout(timer);timer=setTimeout(()=>{video.currentTime=0;video.play().catch(()=>{});card.classList.add("previewing");previewing=true;},450)};
    const stop=()=>{clearTimeout(timer);timer=null;video.pause();video.currentTime=0;card.classList.remove("previewing");previewing=false;};
    card.addEventListener("mouseenter",start); card.addEventListener("mouseleave",stop);
    card.addEventListener("touchstart",start,{passive:true});
    card.addEventListener("touchend",()=>{if(previewing) stop();},{passive:true});
    card.addEventListener("touchcancel",stop,{passive:true});
  });
}
function renderPagination(total){
  const p=document.getElementById("pagination"); if(!p)return; if(total<=1){p.innerHTML="";return;}
  let html=`<button class="btn" ${currentPage===1?"disabled":""} onclick="window.vexaPage(${currentPage-1})">Previous</button>`;
  for(let n=1;n<=total;n++) html+=`<button class="btn ${n===currentPage?"primary":""}" onclick="window.vexaPage(${n})">${n}</button>`;
  html+=`<button class="btn" ${currentPage===total?"disabled":""} onclick="window.vexaPage(${currentPage+1})">Next</button>`; p.innerHTML=html;
}
window.vexaPage=(n)=>{currentPage=Math.max(1,n);renderGrid(currentList);window.scrollTo({top:0,behavior:"smooth"});};

async function renderVideoPage(){
  const box=document.getElementById("videoPage"), id=new URLSearchParams(location.search).get("id");
  let v=VEXA_LOCAL.find(x=>String(x.id)===String(id));
  if(window.supabaseClient && id){const {data}=await window.supabaseClient.from("vexa_published_videos").select("*").eq("id",id).maybeSingle();if(data)v=normalizeVideo(data);}
  if(!v){box.innerHTML="<div class='form'><h1>Video not found</h1><a class='btn' href='index.html'>Back</a></div>";return;}
  v=normalizeVideo(v);
  const creatorHref=v.uploader_id?`creator.html?id=${encodeURIComponent(v.uploader_id)}`:"#";
  box.innerHTML=`<div class="player-wrap"><video class="main-player" controls playsinline poster="${esc(v.thumbnail)}" src="${esc(v.video||"")}"></video></div>
  <div class="video-info"><h1>${esc(v.title)}</h1><div class="muted">${formatViews(v.views||0)} views · ${esc(v.category||"Video")}</div><div class="creator-line">Uploaded by <a class="creator-link" href="${creatorHref}">${esc(v.uploader_name||"Vexa Creator")}</a></div>
  <div class="actions"><button class="action-btn" id="likeBtn" title="Like">♡ <span>${v.likes||0}</span></button><button class="action-btn" id="dislikeBtn" title="Dislike">♧ <span>${v.dislikes||0}</span></button><a class="action-btn" href="${esc(v.download||v.video||"")}" download title="Download">⇩ <span>Download</span></a><button class="action-btn primary" id="shareBtn" title="Share">↗ <span>Share</span></button></div>
  <div class="tags">${(v.tags||[]).map(t=>`<a class="tag-link" href="tags.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div><p>${esc(v.description||"")}</p></div>
  <section class="comment-box"><h2>Comments</h2><form class="comment-form" id="commentForm"><input id="commentName" maxlength="80" placeholder="Name (optional if logged in)"><input id="commentInput" maxlength="1000" placeholder="Add a comment..." required><button class="btn primary">Post</button></form><p class="muted comment-note">Guests can comment. Comments are reviewed before they appear publicly.</p><div id="commentList" class="comment-list"></div></section>
  <section><h2>Related videos</h2><div class="grid" id="trendingGrid"></div></section>`;
  setupReactions(v.id); setupShare(v); await loadComments(v.id); incrementView(v.id); await loadTrending();
}
async function incrementView(id){if(window.supabaseClient) await window.supabaseClient.rpc("record_video_view",{p_video_id:Number(id)});}
async function setupReactions(id){
  const lb=document.getElementById("likeBtn"),db=document.getElementById("dislikeBtn");if(!lb||!db)return;
  const send=async reaction=>{if(!window.supabaseClient){alert("Supabase is not connected.");return;}const {data,error}=await window.supabaseClient.rpc("set_video_reaction",{p_video_id:Number(id),p_reaction:reaction});if(error){alert(error.message);return;}lb.querySelector("span").textContent=data.likes;db.querySelector("span").textContent=data.dislikes;};
  lb.onclick=()=>send("like");db.onclick=()=>send("dislike");
}
function setupShare(v){const b=document.getElementById("shareBtn");if(!b)return;b.onclick=async()=>{const url=location.href;if(navigator.share){try{await navigator.share({title:v.title,url});return;}catch(e){}}try{await navigator.clipboard.writeText(url);alert("Link copied.");}catch(e){prompt("Copy this link:",url);}};}
async function loadComments(videoId){
  const list=document.getElementById("commentList"),form=document.getElementById("commentForm");if(!list)return;
  const render=rows=>{list.innerHTML=rows?.length?rows.map(c=>`<article class="comment"><div class="comment-head"><strong>${esc(c.guest_name||c.author_name||c.username||"User")}</strong><span class="muted">${new Date(c.created_at).toLocaleDateString()}</span></div><div>${esc(c.body||c.comment||"")}</div></article>`).join(""):"<p class='muted'>No comments yet.</p>";};
  if(!window.supabaseClient){render([]);return;}
  const {data,error}=await window.supabaseClient.from("video_comments").select("*").eq("video_id",videoId).eq("status","approved").order("created_at",{ascending:false}).limit(100);
  render(error?[]:data);
  form.onsubmit=async e=>{
    e.preventDefault();
    const input=document.getElementById("commentInput"),nameInput=document.getElementById("commentName");
    const body=input.value.trim(); if(!body)return;
    const guestName=(nameInput.value.trim()||"Guest").slice(0,80);
    const {data:{user}}=await window.supabaseClient.auth.getUser();
    const row={video_id:videoId,user_id:user?.id||null,guest_name:guestName,body,status:"pending"};
    const {error}=await window.supabaseClient.from("video_comments").insert(row);
    if(error)alert(error.message);else{input.value="";if(!user)nameInput.value="";alert("Comment submitted for review.");}
  };
}
async function loadTrending(){const grid=document.getElementById("trendingGrid");if(!grid)return;let list=VEXA_LOCAL;if(window.supabaseClient){const {data}=await window.supabaseClient.from("vexa_published_videos").select("*").limit(8);if(data?.length)list=data.map(normalizeVideo);}grid.innerHTML=list.slice(0,8).map(createCard).join("");setupPreviews();}
async function loadTags(){
  const cloud=document.getElementById("tagCloud");let tags=[];
  if(window.supabaseClient){const {data}=await window.supabaseClient.from("vexa_published_videos").select("tags").limit(500);if(data) data.forEach(v=>(Array.isArray(v.tags)?v.tags:[]).forEach(t=>tags.push(String(t))));}
  if(!tags.length)VEXA_LOCAL.forEach(v=>(v.tags||[]).forEach(t=>tags.push(String(t))));
  const counts={};tags.forEach(t=>counts[t]=(counts[t]||0)+1);const unique=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b));
  const selected=new URLSearchParams(location.search).get("tag");
  cloud.innerHTML=unique.map(t=>`<a class="tag-link" href="videos.html?tag=${encodeURIComponent(t)}">#${esc(t)} <span class="muted">${counts[t]}</span></a>`).join("")||"<p class='muted'>No tags yet.</p>";
  if(selected){document.querySelectorAll(".tag-link").forEach(a=>{if(a.textContent.toLowerCase().includes(selected.toLowerCase()))a.style.background="var(--accent)";});}
}
async function renderCreatorPage(){
  const box=document.getElementById("creatorPage"),id=new URLSearchParams(location.search).get("id");if(!id){box.innerHTML="<p class='muted'>Creator not found.</p>";return;}
  let videos=[];
  if(window.supabaseClient){const {data}=await window.supabaseClient.from("videos").select("*").eq("uploader_id",id).eq("status","published").limit(300);if(data)videos=data.map(normalizeVideo);}
  const name=videos[0]?.uploader_name||"Creator";
  box.innerHTML=`<div class="profile-head"><div class="avatar">${esc(name.slice(0,1).toUpperCase())}</div><div><h1 style="margin:0">${esc(name)}</h1><div class="muted">Published content</div></div></div><div class="grid" id="creatorGrid"></div>`;
  document.getElementById("creatorGrid").innerHTML=videos.map(createCard).join("")||"<p class='muted'>No published content yet.</p>";
  setupPreviews();
}
function formatViews(n){return Number(n||0).toLocaleString();}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
