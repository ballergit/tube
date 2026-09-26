const VEXA_LOCAL = window.VEXA_VIDEOS || [];
const PAGE_SIZE = 30;
let allVideos = [], currentPage = 1, currentList = [];
let relatedPool = [], relatedShown = 0;

const vexaEsc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = {
  like:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H4V10h3Zm2 11h8.2a2.5 2.5 0 0 0 2.4-1.8l2-7A2.5 2.5 0 0 0 17.2 9H14l.7-3.3A2.3 2.3 0 0 0 12.5 3L9 9.5V21Z" fill="currentColor"/></svg>',
  dislike:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H4v11h3Zm2-11h8.2a2.5 2.5 0 0 1 2.4 1.8l2 7a2.5 2.5 0 0 1-2.4 3.2H14l.7 3.3A2.3 2.3 0 0 1 12.5 21L9 14.5V3Z" fill="currentColor"/></svg>',
  comment:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v12H8l-4 4V4Zm3 5h10v2H7V9Zm0 4h7v2H7v-2Z" fill="currentColor"/></svg>',
  download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.2l3.5-3.5 1.4 1.4L12 17l-5.9-5.9 1.4-1.4 3.5 3.5V3ZM4 19h16v2H4v-2Z" fill="currentColor"/></svg>',
  save:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18l-7-3-7 3V3Zm2 2v12.9l5-2.1 5 2.1V5H7Z" fill="currentColor"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.3 1.1L8.9 13.3a3.4 3.4 0 0 0 0-2.6l6.8-3.8A3 3 0 1 0 15 5c0 .3 0 .6.1.9L8.3 9.7a3 3 0 1 0 0 4.6l6.8 3.8c-.1.3-.1.6-.1.9a3 3 0 1 0 3-3Z" fill="currentColor"/></svg>',
  report:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Zm-1 5h2v6h-2V8Zm0 8h2v2h-2v-2Z" fill="currentColor"/></svg>'
};

window.addEventListener('DOMContentLoaded', async()=>{
  setupTheme(); setupMobileSidebar(); await applySiteSettings();
  if(document.getElementById('tagCloud')) return loadTags();
  if(document.getElementById('creatorPage')) return renderCreatorPage();
  if(document.getElementById('videoPage')) return renderVideoPage();
  if(document.getElementById('photoGrid')) return loadPhotosPage();
  if(document.getElementById('videoGrid')) return loadListing();
});

function setupTheme(){
  const saved=localStorage.getItem('vexa-theme');
  document.documentElement.classList.toggle('light',saved==='light');
  const b=document.getElementById('themeBtn');
  if(b)b.onclick=()=>{const light=!document.documentElement.classList.contains('light');document.documentElement.classList.toggle('light',light);localStorage.setItem('vexa-theme',light?'light':'dark');};
}

function setupMobileSidebar(){
  const btn=document.getElementById('hamburgerBtn'), aside=document.querySelector('.sidebar');
  if(!btn||!aside)return;
  btn.onclick=()=>{const open=aside.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));};
  aside.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{aside.classList.remove('open');btn.setAttribute('aria-expanded','false');}));
}

async function applySiteSettings(){
  const client=window.supabaseClient;if(!client)return;
  try{
    const {data:s}=await client.from('site_settings').select('*').eq('id',1).maybeSingle();
    if(!s)return;
    if(s.site_name){document.querySelectorAll('.brand-text').forEach(el=>el.textContent=s.site_name);document.title=document.title.replace(/^Vexa/,s.site_name);}
    if(s.logo_url)document.querySelectorAll('.brand-logo').forEach(img=>{img.src=s.logo_url;img.hidden=false;});
    if(s.favicon_url){let link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}link.href=s.favicon_url;}
    if(s.accent_color)document.documentElement.style.setProperty('--accent',s.accent_color);
    if(Array.isArray(s.nav_items)&&s.nav_items.length){
      const current=location.pathname.split('/').pop()||'index.html';
      document.querySelectorAll('.sidebar').forEach(aside=>aside.innerHTML=s.nav_items.map(item=>`<a class="side-link${item.href===current?' active':''}" href="${vexaEsc(item.href)}"><span>${vexaEsc(item.label)}</span></a>`).join(''));
      setupMobileSidebar();
    }
    if(s.footer_text)document.querySelectorAll('.copyright').forEach(el=>el.textContent=s.footer_text);
    if(s.contact_email)document.querySelectorAll('.footer-contact-email').forEach(el=>{el.textContent=s.contact_email;el.href='mailto:'+s.contact_email;el.hidden=false;});
    if(s.social&&typeof s.social==='object')document.querySelectorAll('#footerSocial').forEach(el=>el.innerHTML=Object.entries(s.social).filter(([,v])=>v).map(([k,v])=>`<a href="${vexaEsc(v)}" target="_blank" rel="noopener">${vexaEsc(k)}</a>`).join(''));
  }catch(e){console.warn('Site settings unavailable',e);}
}

async function loadListing(){
  allVideos=VEXA_LOCAL.map(normalizeVideo);
  if(window.supabaseClient){const {data,error}=await window.supabaseClient.from('vexa_published_videos').select('*').limit(300);if(!error&&data?.length)allVideos=data.map(normalizeVideo);}
  const selectedTag=new URLSearchParams(location.search).get('tag');
  if(selectedTag)allVideos=allVideos.filter(v=>(v.tags||[]).some(t=>String(t).toLowerCase()===selectedTag.toLowerCase()));
  if(document.body.dataset.home==='true')return renderHome();
  renderGrid(allVideos);
}
function normalizeVideo(v){return {...v,thumbnail:v.thumbnail_url||v.thumbnail||'https://placehold.co/640x360/111/fff?text=Vexa',video:v.video_url||v.video,preview:v.preview_url||v.preview,download:v.video_url||v.download,category:v.category||'Video',tags:Array.isArray(v.tags)?v.tags:[],uploader_id:v.uploader_id||v.user_id||v.created_by,uploader_name:v.uploader_name||v.creator_name||v.username||'Vexa Creator',duration:v.duration||v.duration_text||'',quality:v.quality||v.resolution||''};}
function formatViews(n){return Number(n||0).toLocaleString();}
function renderGrid(list=allVideos){
  currentList=list;const grid=document.getElementById('videoGrid');if(!grid)return;
  const total=Math.max(1,Math.ceil(list.length/PAGE_SIZE));currentPage=Math.min(currentPage,total);const start=(currentPage-1)*PAGE_SIZE;
  grid.innerHTML=list.slice(start,start+PAGE_SIZE).map(createCard).join('')||`<p class="muted">No videos found.</p>`;setupPreviews();renderPagination(total);
}
function createCard(v){
  const x=normalizeVideo(v);return `<article class="card video-card" data-id="${vexaEsc(x.id)}"><a class="video-link" href="video.html?id=${encodeURIComponent(x.id)}"><div class="thumb preview-wrap"><img class="thumb-img" src="${vexaEsc(x.thumbnail)}" alt="" loading="lazy">${x.preview?`<video class="preview-video" muted playsinline preload="none" src="${vexaEsc(x.preview)}"></video>`:''}${x.duration?`<span class="duration-badge">${vexaEsc(x.duration)}</span>`:''}${x.quality?`<span class="quality-badge">${vexaEsc(x.quality)}</span>`:''}</div><div class="card-body"><h3>${vexaEsc(x.title)}</h3><div class="card-meta">${formatViews(x.views||0)} views</div></div></a></article>`;
}
function setupPreviews(){document.querySelectorAll('.video-card').forEach(card=>{const video=card.querySelector('.preview-video');if(!video)return;let timer=null,previewing=false;const start=()=>{clearTimeout(timer);timer=setTimeout(()=>{video.currentTime=0;video.play().catch(()=>{});card.classList.add('previewing');previewing=true;},450)};const stop=()=>{clearTimeout(timer);timer=null;video.pause();video.currentTime=0;card.classList.remove('previewing');previewing=false};card.addEventListener('mouseenter',start);card.addEventListener('mouseleave',stop);card.addEventListener('touchstart',start,{passive:true});card.addEventListener('touchend',()=>{if(previewing)stop()},{passive:true});card.addEventListener('touchcancel',stop,{passive:true});});}
function renderPagination(total){const p=document.getElementById('pagination');if(!p)return;if(total<=1){p.innerHTML='';return;}let html=`<button class="btn" ${currentPage===1?'disabled':''} onclick="window.vexaPage(${currentPage-1})">Previous</button>`;for(let n=1;n<=total;n++)html+=`<button class="btn ${n===currentPage?'primary':''}" onclick="window.vexaPage(${n})">${n}</button>`;html+=`<button class="btn" ${currentPage===total?'disabled':''} onclick="window.vexaPage(${currentPage+1})">Next</button>`;p.innerHTML=html;}
window.vexaPage=n=>{currentPage=Math.max(1,n);renderGrid(currentList);window.scrollTo({top:0,behavior:'smooth'});};

async function renderHome(){
  const main=document.querySelector('.main');if(!main)return;
  let settings={};try{const {data}=await window.supabaseClient.from('site_settings').select('homepage_sections').eq('id',1).maybeSingle();settings=data?.homepage_sections||{};}catch(e){}
  const defaults=[{key:'watched',label:'Videos Being Watched',enabled:true},{key:'latest',label:'Latest Videos',enabled:false},{key:'featured',label:'Featured',enabled:false},{key:'trending',label:'Trending',enabled:false}];
  const sections=Array.isArray(settings?.order)?settings.order.map(k=>defaults.find(x=>x.key===k)).filter(Boolean):defaults;
  const enabled=Array.isArray(settings?.enabled)?settings.enabled:defaults.filter(x=>x.enabled).map(x=>x.key);
  const active=sections.filter(s=>enabled.includes(s.key));
  main.innerHTML=active.map(s=>`<section class="home-section" data-home-section="${s.key}"><div class="section-title"><h1>${vexaEsc(s.label)}</h1>${s.key==='watched'?'<span class="section-plus">+</span>':''}</div><div class="grid home-grid" id="home-${s.key}"></div></section>`).join('')+'<div id="homePagination" class="pagination"></div>';
  for(const s of active){let list=allVideos;if(s.key==='featured')list=allVideos.filter(v=>v.featured);if(s.key==='trending')list=allVideos.filter(v=>v.trending);const grid=document.getElementById(`home-${s.key}`);if(!list.length){grid.innerHTML='<p class="muted">No published videos yet.</p>';continue;}grid.innerHTML=list.slice(0,12).map(createCard).join('');}
  setupPreviews();
}

async function loadPhotosPage(){
  const grid=document.getElementById('photoGrid');if(!grid)return;let photos=[];
  if(window.supabaseClient){const {data,error}=await window.supabaseClient.from('vexa_published_photos').select('*').limit(300);if(!error&&data)photos=data;}
  grid.innerHTML=photos.map(p=>`<article class="card photo-card"><a href="${vexaEsc(p.image_url)}" target="_blank" rel="noopener"><img src="${vexaEsc(p.thumbnail_url||p.image_url)}" alt="${vexaEsc(p.title||'Photo')}" loading="lazy"></a><div class="card-body"><h3>${vexaEsc(p.title||'Untitled')}</h3><div class="card-meta">${formatViews(p.views||0)} views</div></div></article>`).join('')||'<p class="muted">No published photos yet.</p>';
}

async function renderVideoPage(){
  const box=document.getElementById('videoPage'),id=new URLSearchParams(location.search).get('id');let v=VEXA_LOCAL.find(x=>String(x.id)===String(id));
  if(window.supabaseClient&&id){const {data}=await window.supabaseClient.from('vexa_published_videos').select('*').eq('id',id).maybeSingle();if(data)v=normalizeVideo(data);}
  if(!v){box.innerHTML='<div class="form"><h1>Video not found</h1><a class="btn" href="index.html">Back</a></div>';return;}v=normalizeVideo(v);
  const creatorHref=v.uploader_id?`creator.html?id=${encodeURIComponent(v.uploader_id)}`:'#';
  const badges=[v.duration?`<span class="meta-badge">${vexaEsc(v.duration)}</span>`:'',v.quality?`<span class="meta-badge quality">${vexaEsc(v.quality)}</span>`:''].join('');
  box.innerHTML=`<div class="player-wrap"><video class="main-player" controls playsinline poster="${vexaEsc(v.thumbnail)}" src="${vexaEsc(v.video||'')}"></video></div><div class="video-info"><h1>${vexaEsc(v.title)}</h1><div class="video-top-meta">${badges}<span class="muted">${formatViews(v.views||0)} views</span></div><div class="creator-line"><a class="creator-pill" href="${creatorHref}">Creator: ${vexaEsc(v.uploader_name||'Vexa Creator')}</a><span id="followSlot"></span></div><div class="tags">${(v.tags||[]).map(t=>`<a class="tag-link" href="tags.html?tag=${encodeURIComponent(t)}">${vexaEsc(t)}</a>`).join('')}</div><p>${vexaEsc(v.description||'')}</p></div><div class="actions"><button class="action-btn" id="likeBtn">${icon.like}<span>Like</span><strong class="action-count">${v.likes||0}</strong></button><button class="action-btn" id="dislikeBtn">${icon.dislike}<span>Dislike</span><strong class="action-count">${v.dislikes||0}</strong></button><button class="action-btn" id="commentJump">${icon.comment}<span>Comments</span><strong class="action-count" id="commentCount">0</strong></button><a class="action-btn" href="${vexaEsc(v.download||v.video||'')}" download>${icon.download}<span>Download</span></a><button class="action-btn" id="saveBtn">${icon.save}<span>Save</span></button><button class="action-btn" id="shareBtn">${icon.share}<span>Share</span></button><a class="action-btn" href="report.html?video=${encodeURIComponent(v.id)}">${icon.report}<span>Report</span></a></div><section class="comment-box" id="commentsSection"><h2>Comments</h2><form class="comment-form" id="commentForm"><input id="commentName" maxlength="80" placeholder="Name (optional if logged in)"><input id="commentInput" maxlength="1000" placeholder="Add a comment..." required><button class="btn primary">Post</button></form><div id="commentList" class="comment-list"></div></section><section class="related-wrap"><h2>Related videos</h2><div class="grid home-grid" id="relatedGrid"></div><div class="homepage-more"><button class="btn" id="moreRelated">See more</button></div></section>`;
  setupReactions(v.id);setupShare(v);setupSave(v);document.getElementById('commentJump').onclick=()=>document.getElementById('commentsSection').scrollIntoView({behavior:'smooth'});await loadComments(v.id);await setupVideoFollow(v);await loadRelated(v);await incrementView(v.id);
}
async function setupVideoFollow(v){const slot=document.getElementById('followSlot');if(!slot||!v.uploader_id||!window.supabaseClient)return;const auth=await window.supabaseClient.auth.getUser();const user=auth.data.user;if(!user||user.id===v.uploader_id)return;const {data}=await window.supabaseClient.from('creator_followers').select('creator_id').eq('creator_id',v.uploader_id).eq('follower_id',user.id).maybeSingle();let following=!!data;slot.innerHTML=`<button class="btn follow-btn" id="videoFollowBtn">${following?'Following':'Follow'}</button>`;document.getElementById('videoFollowBtn').onclick=async()=>{const q=following?window.supabaseClient.from('creator_followers').delete().eq('creator_id',v.uploader_id).eq('follower_id',user.id):window.supabaseClient.from('creator_followers').insert({creator_id:v.uploader_id,follower_id:user.id});const {error}=await q;if(error){alert(error.message);return;}following=!following;document.getElementById('videoFollowBtn').textContent=following?'Following':'Follow';};}
async function incrementView(id){if(window.supabaseClient)await window.supabaseClient.rpc('record_video_view',{p_video_id:Number(id)});}
async function setupReactions(id){const lb=document.getElementById('likeBtn'),db=document.getElementById('dislikeBtn');if(!lb||!db)return;const send=async reaction=>{const {data,error}=await window.supabaseClient.rpc('set_video_reaction',{p_video_id:Number(id),p_reaction:reaction});if(error){alert(error.message);return;}lb.querySelector('.action-count').textContent=data.likes;db.querySelector('.action-count').textContent=data.dislikes;};lb.onclick=()=>send('like');db.onclick=()=>send('dislike');}
function setupShare(v){const b=document.getElementById('shareBtn');if(!b)return;b.onclick=async()=>{const url=location.href;if(navigator.share){try{await navigator.share({title:v.title,url});return;}catch(e){}}try{await navigator.clipboard.writeText(url);alert('Link copied.');}catch(e){prompt('Copy this link:',url);}};}
async function setupSave(v){const b=document.getElementById('saveBtn');if(!b)return;let saved=localStorage.getItem('vexa-saved-'+v.id)==='1';if(window.supabaseClient){const auth=await window.supabaseClient.auth.getUser();if(auth.data.user){const q=await window.supabaseClient.from('saved_videos').select('video_id').eq('video_id',v.id).eq('user_id',auth.data.user.id).maybeSingle();saved=!!q.data;}}b.classList.toggle('primary',saved);b.onclick=async()=>{if(!window.supabaseClient){saved=!saved;localStorage.setItem('vexa-saved-'+v.id,saved?'1':'0');b.classList.toggle('primary',saved);return;}const auth=await window.supabaseClient.auth.getUser();if(!auth.data.user){location.href='login.html';return;}let result;if(saved)result=await window.supabaseClient.from('saved_videos').delete().eq('video_id',v.id).eq('user_id',auth.data.user.id);else result=await window.supabaseClient.from('saved_videos').insert({video_id:v.id,user_id:auth.data.user.id});if(result.error){alert(result.error.message);return;}saved=!saved;b.classList.toggle('primary',saved);};}
async function loadComments(videoId){
  const list=document.getElementById('commentList'),form=document.getElementById('commentForm');if(!list)return;
  const render=rows=>{list.innerHTML=rows?.length?rows.map(c=>`<article class="comment"><div class="comment-head"><strong>${vexaEsc(c.guest_name||c.author_name||c.username||'User')}</strong><span class="muted">${new Date(c.created_at).toLocaleDateString()}</span></div><div>${vexaEsc(c.body||'')}</div></article>`).join(''):'<p class="muted">No comments yet.</p>';const count=document.getElementById('commentCount');if(count)count.textContent=String(rows?.length||0);};
  if(!window.supabaseClient){render([]);return;}
  const {data,error}=await window.supabaseClient.from('video_comments').select('*').eq('video_id',videoId).eq('status','approved').order('created_at',{ascending:false}).limit(100);render(error?[]:data);
  form.onsubmit=async e=>{e.preventDefault();const input=document.getElementById('commentInput'),nameInput=document.getElementById('commentName'),body=input.value.trim();if(!body)return;const guestName=(nameInput.value.trim()||'Guest').slice(0,80);const {data:{user}}=await window.supabaseClient.auth.getUser();const row={video_id:videoId,user_id:user?.id||null,guest_name:guestName,body,status:'pending'};const {error}=await window.supabaseClient.from('video_comments').insert(row);if(error)alert(error.message);else{input.value='';if(!user)nameInput.value='';}};
}
async function loadRelated(v){
  const grid=document.getElementById('relatedGrid'),more=document.getElementById('moreRelated');if(!grid)return;let list=[];if(window.supabaseClient){const {data}=await window.supabaseClient.from('vexa_published_videos').select('*').neq('id',v.id).limit(300);if(data)list=data.map(normalizeVideo);}if(!list.length)list=allVideos.filter(x=>String(x.id)!==String(v.id));
  const same=list.filter(x=>(v.tags||[]).some(t=>(x.tags||[]).includes(t))||x.category===v.category);const rest=list.filter(x=>!same.includes(x));relatedPool=[...same,...rest];relatedShown=0;const render=()=>{grid.innerHTML=relatedPool.slice(0,relatedShown).map(createCard).join('')||'<p class="muted">No related videos yet.</p>';setupPreviews();more.hidden=relatedShown>=relatedPool.length;};relatedShown=Math.min(8,relatedPool.length);render();more.onclick=()=>{relatedShown=Math.min(relatedShown+8,relatedPool.length);render();};
}
async function loadTags(){
  const cloud=document.getElementById('tagCloud');let tags=[];if(window.supabaseClient){const {data}=await window.supabaseClient.from('vexa_published_videos').select('tags').limit(500);if(data)data.forEach(v=>(Array.isArray(v.tags)?v.tags:[]).forEach(t=>tags.push(String(t))));}if(!tags.length)VEXA_LOCAL.forEach(v=>(v.tags||[]).forEach(t=>tags.push(String(t))));const counts={};tags.forEach(t=>counts[t]=(counts[t]||0)+1);const unique=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b));const selected=new URLSearchParams(location.search).get('tag');cloud.innerHTML=unique.map(t=>`<a class="tag-link" href="videos.html?tag=${encodeURIComponent(t)}">${vexaEsc(t)} <span class="muted">${counts[t]}</span></a>`).join('')||'<p class="muted">No tags yet.</p>';if(selected)document.querySelectorAll('.tag-link').forEach(a=>{if(a.textContent.toLowerCase().includes(selected.toLowerCase()))a.style.background='var(--accent)';});
}
async function renderCreatorPage(){
  const box=document.getElementById('creatorPage'),id=new URLSearchParams(location.search).get('id');if(!id){box.innerHTML='<p class="muted">Creator not found.</p>';return;}let videos=[];if(window.supabaseClient){const {data}=await window.supabaseClient.from('videos').select('*').eq('uploader_id',id).eq('status','published').limit(300);if(data)videos=data.map(normalizeVideo);}let profile=null;if(window.supabaseClient){const {data}=await window.supabaseClient.from('profiles').select('username,display_name').eq('id',id).maybeSingle();profile=data;}const name=profile?.display_name||profile?.username||videos[0]?.uploader_name||'Creator';let followerCount=0,following=false,currentUser=null;if(window.supabaseClient){const count=await window.supabaseClient.rpc('vexa_follow_counts',{p_creator_id:id});if(!count.error)followerCount=Number(count.data||0);const auth=await window.supabaseClient.auth.getUser();currentUser=auth.data.user;if(currentUser&&currentUser.id!==id){const f=await window.supabaseClient.from('creator_followers').select('creator_id').eq('creator_id',id).eq('follower_id',currentUser.id).maybeSingle();following=!!f.data;}}
  const followButton=currentUser&&currentUser.id!==id?`<button class="btn follow-btn" id="followBtn">${following?'Following':'Follow'}</button>`:'';box.innerHTML=`<div class="profile-head"><div class="avatar">${vexaEsc(name.slice(0,1).toUpperCase())}</div><div style="flex:1"><h1 style="margin:0">${vexaEsc(name)}</h1><div class="muted"><span id="followerCount">${followerCount}</span> followers</div></div>${followButton}</div><div class="grid home-grid" id="creatorGrid"></div>`;document.getElementById('creatorGrid').innerHTML=videos.map(createCard).join('')||'<p class="muted">No published content yet.</p>';setupPreviews();const fb=document.getElementById('followBtn');if(fb)fb.onclick=async()=>{if(following){const {error}=await window.supabaseClient.from('creator_followers').delete().eq('creator_id',id).eq('follower_id',currentUser.id);if(error){alert(error.message);return;}following=false;}else{const {error}=await window.supabaseClient.from('creator_followers').insert({creator_id:id,follower_id:currentUser.id});if(error){alert(error.message);return;}following=true;}fb.textContent=following?'Following':'Follow';const count=await window.supabaseClient.rpc('vexa_follow_counts',{p_creator_id:id});if(!count.error)document.getElementById('followerCount').textContent=Number(count.data||0);};
}
