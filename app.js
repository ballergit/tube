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
  setupTheme(); setupMobileSidebar(); setupAccountMenu(); setupAuthUI(); setupAdultAgreement(); await applySiteSettings();
  if(document.getElementById('communityProfiles')) return loadCommunity();
  if(document.getElementById('tagCloud')) return loadTags();
  if(document.getElementById('creatorPage')) return renderCreatorPage();
  if(document.getElementById('videoPage')) return renderVideoPage();
  if(document.getElementById('photoGrid')) return loadPhotosPage();
  if(document.getElementById('homeSearchBtn')) setupHomeSearch();
  if(document.getElementById('videoGrid')) return loadListing();
});



async function setupAuthUI(){
  const client=window.supabaseClient;
  if(!client)return;
  try{
    const {data:{session}}=await client.auth.getSession();
    updateAuthUI(session?.user||null);
    client.auth.onAuthStateChange((_event,newSession)=>updateAuthUI(newSession?.user||null));
  }catch(e){console.warn('Auth UI unavailable',e);}
}

function updateAuthUI(user){
  const path=location.pathname.split('/').pop()||'index.html';
  if(path==='admin-login.html'||path==='admin.html')return;
  const account=document.getElementById('accountBtn');
  const menu=document.getElementById('accountMenu');
  const container=document.getElementById('profileDropdown');
  const nameEl=document.getElementById('summaryName');
  const emailEl=document.getElementById('summaryEmail');
  const avatarEl=document.querySelector('#profileDropdown .avatar');
  const profileLink=document.getElementById('accountProfile');
  const applyCreatorLink=document.getElementById('applyCreatorLink');
  const toggle=document.getElementById('themeToggle');

  if(account){
    account.hidden=!!user;
    account.href='login.html';
  }
  if(container){
    container.hidden=!user;
    if(!user)container.classList.remove('active');
  }
  if(menu)menu.hidden=!user;

  const displayName=user?(user.user_metadata?.username||user.user_metadata?.display_name||user.email?.split('@')[0]||'Account'):'Account';
  if(nameEl)nameEl.textContent=displayName;
  if(emailEl)emailEl.textContent=user?.email||'';
  if(avatarEl){
    avatarEl.alt=user?`${displayName} profile`:'User Profile';
    const url=user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'';
    if(url){avatarEl.src=url;avatarEl.hidden=false;}
    else{avatarEl.removeAttribute('src');avatarEl.hidden=true;}
  }
  if(toggle)toggle.checked=localStorage.getItem('vexa-theme')!=='light';

  if(user&&window.supabaseClient){
    window.supabaseClient.rpc('is_vexa_creator').then(({data,error})=>{
      const isCreator=!error&&data===true;
      if(profileLink)profileLink.hidden=!isCreator;
      if(applyCreatorLink)applyCreatorLink.hidden=isCreator;
      if(isCreator&&profileLink)profileLink.href='profile.html?id='+encodeURIComponent(user.id);
    }).catch(()=>{
      if(profileLink)profileLink.hidden=true;
      if(applyCreatorLink)applyCreatorLink.hidden=false;
    });
  }else{
    if(profileLink)profileLink.hidden=true;
    if(applyCreatorLink)applyCreatorLink.hidden=true;
  }

  const logout=document.getElementById('accountLogout');
  if(logout){
    logout.hidden=!user;
    logout.onclick=async(e)=>{
      e.preventDefault();
      const {error}=await window.supabaseClient.auth.signOut();
      if(error)alert(error.message);else location.href='index.html';
    };
  }
  syncUserPreferences(user);
}

function setupAccountMenu(){
  const actions=document.querySelector('.header-actions');if(!actions)return;
  let account=document.getElementById('accountBtn');
  if(!account){
    account=document.createElement('a');account.id='accountBtn';account.className='header-account-btn';account.href='login.html';account.title='Log in';account.setAttribute('aria-label','Log in');
    account.textContent='Login';
    actions.prepend(account);
  }
  let container=document.getElementById('profileDropdown');
  if(!container){
    container=document.createElement('div');container.id='profileDropdown';container.className='profile-container';container.hidden=true;
    container.innerHTML=`
      <button class="profile-trigger" id="profileTrigger" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open profile menu" onclick="toggleDropdown(event)">
        <img src="" alt="User Profile" class="avatar" hidden>
      </button>
      <div class="dropdown-menu" id="accountMenu">
        <div class="user-summary"><p class="summary-name" id="summaryName">Account</p><p class="summary-email" id="summaryEmail"></p></div>
        <ul class="menu-links">
          <li><a href="creator.html" id="accountProfile" hidden>My Profile</a></li>
          <li><a href="saved.html">Saved</a></li>
          <li><a href="following.html">Following</a></li>
          <li><a href="account.html#notifications">Notifications</a></li>
          <li><a href="account.html#settings">Account Settings</a></li>
          <li><a href="privacy.html">Security &amp; Privacy</a></li>
          <li><a href="creator-apply.html" id="applyCreatorLink">Apply to Become a Creator</a></li>
          
          <li class="toggle-item"><span>Dark Mode</span><label class="switch"><input type="checkbox" id="themeToggle" aria-label="Dark Mode"><span class="slider"></span></label></li>
        </ul>
        <div class="divider"></div><div class="logout-section"><a href="#logout" class="logout-btn" id="accountLogout">Log Out</a></div>
      </div>`;
    actions.prepend(container);
  }
  const trigger=container.querySelector('.profile-trigger');
  const themeToggle=document.getElementById('themeToggle');
  if(themeToggle)themeToggle.onchange=()=>setTheme(themeToggle.checked?'dark':'light');
  document.addEventListener('click',e=>{
    if(!container.contains(e.target)){
      container.classList.remove('active');
      if(trigger)trigger.setAttribute('aria-expanded','false');
    }
  },{passive:true});
  applySavedPreferences();
}

function toggleDropdown(event){
  if(event)event.stopPropagation();
  const container=document.getElementById('profileDropdown');if(!container||container.hidden)return;
  const trigger=container.querySelector('.profile-trigger');
  const isActive=container.classList.toggle('active');
  if(trigger)trigger.setAttribute('aria-expanded',String(isActive));
}

function setupTheme(){applySavedPreferences();}
function applySavedPreferences(){
  const theme=localStorage.getItem('vexa-theme')||'dark';
  document.documentElement.classList.toggle('light',theme==='light');
  const toggle=document.getElementById('themeToggle');
  if(toggle)toggle.checked=theme!=='light';
}
function setTheme(theme){
  const next=theme==='light'?'light':'dark';
  localStorage.setItem('vexa-theme',next);
  document.documentElement.classList.toggle('light',next==='light');
  const toggle=document.getElementById('themeToggle');
  if(toggle)toggle.checked=next==='dark';
  syncPreference('theme',next);
}
async function syncUserPreferences(user){
  if(!user||!window.supabaseClient)return;
  try{
    const {data}=await window.supabaseClient.from('user_preferences').select('theme').eq('user_id',user.id).maybeSingle();
    if(data?.theme){
      localStorage.setItem('vexa-theme',data.theme);
      document.documentElement.classList.toggle('light',data.theme==='light');
      const toggle=document.getElementById('themeToggle');
      if(toggle)toggle.checked=data.theme==='dark';
    }
  }catch(e){}
}
async function syncPreference(key,value){
  const c=window.supabaseClient;if(!c)return;
  try{
    const {data:{user}}=await c.auth.getUser();if(!user)return;
    await c.from('user_preferences').upsert({user_id:user.id,[key]:value},{onConflict:'user_id'});
  }catch(e){}
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
  const selectedTag=new URLSearchParams(location.search).get('tag');
  if(window.supabaseClient){
    const from=Math.max(0,(currentPage-1)*PAGE_SIZE),to=from+PAGE_SIZE-1;
    let query=window.supabaseClient.from('vexa_published_videos').select('*',{count:'exact'}).order('created_at',{ascending:false}).range(from,to);
    const search=new URLSearchParams(location.search).get('search');
    if(selectedTag)query=query.contains('tags',[selectedTag]);
    if(search)query=query.ilike('title',`%${search.replace(/[%_]/g,'')}%`);
    const {data,error,count}=await query;
    if(!error&&Array.isArray(data)){
      allVideos=data.map(normalizeVideo);
      window.vexaServerVideoCount=count||0;
      window.vexaServerVideoPage=true;
    }
  }
  if(document.body.dataset.home==='true')return renderHome();
  renderGrid(allVideos);
}

function normalizeVideo(v){return {...v,thumbnail:v.thumbnail_url||v.thumbnail||'https://placehold.co/640x360/111/fff?text=Vexa',video:v.video_url||v.video,preview:v.preview_url||v.preview,download:v.video_url||v.download,category:v.category||'Video',tags:Array.isArray(v.tags)?v.tags:[],uploader_id:v.uploader_id||v.user_id||v.created_by,uploader_name:v.uploader_name||v.creator_name||v.username||'Vexa Creator',duration:v.duration||v.duration_text||'',quality:v.quality||v.resolution||''};}
function formatUploadAge(date){if(!date)return'Upload date unavailable';const t=new Date(date).getTime();if(!Number.isFinite(t))return'Upload date unavailable';let sec=Math.max(0,Math.floor((Date.now()-t)/1000));if(sec<60)return'Uploaded just now';const min=Math.floor(sec/60);if(min<60)return`Uploaded ${min} minute${min===1?'':'s'} ago`;const hr=Math.floor(min/60);if(hr<24)return`Uploaded ${hr} hour${hr===1?'':'s'} ago`;const day=Math.floor(hr/24);if(day<30)return`Uploaded ${day} day${day===1?'':'s'} ago`;const month=Math.floor(day/30);if(month<12)return`Uploaded ${month} month${month===1?'':'s'} ago`;const year=Math.floor(month/12);return`Uploaded ${year} year${year===1?'':'s'} ago`;}


function setupHomeSearch(){
  const btn=document.getElementById('homeSearchBtn'),box=document.getElementById('homeSearch'),form=document.getElementById('homeSearchForm'),input=document.getElementById('homeSearchInput');
  if(!btn||!box||!form)return;
  btn.onclick=()=>{box.hidden=!box.hidden;if(!box.hidden){input.focus();}};
  form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(q)location.href='videos.html?search='+encodeURIComponent(q);};
}

function formatViews(n){return Number(n||0).toLocaleString();}
function renderGrid(list=allVideos){
  currentList=list;const grid=document.getElementById('videoGrid');if(!grid)return;
  const total=window.vexaServerVideoPage?Math.max(1,Math.ceil((window.vexaServerVideoCount||list.length)/PAGE_SIZE)):Math.max(1,Math.ceil(list.length/PAGE_SIZE));
  currentPage=Math.min(currentPage,total);const start=window.vexaServerVideoPage?0:(currentPage-1)*PAGE_SIZE;
  grid.innerHTML=list.slice(start,start+PAGE_SIZE).map(createCard).join('')||`<p class="muted">No videos found.</p>`;setupPreviews();renderPagination(total);
}
function createCard(v){
  const x=normalizeVideo(v);return `<article class="card video-card" data-id="${vexaEsc(x.id)}"><a class="video-link" href="video.html?id=${encodeURIComponent(x.id)}"><div class="thumb preview-wrap"><img class="thumb-img" src="${vexaEsc(x.thumbnail)}" alt="" loading="lazy">${x.preview?`<video class="preview-video" muted playsinline preload="none" src="${vexaEsc(x.preview)}"></video>`:''}${x.duration?`<span class="duration-badge">${vexaEsc(x.duration)}</span>`:''}${x.quality?`<span class="quality-badge">${vexaEsc(x.quality)}</span>`:''}</div><div class="card-body"><h3>${vexaEsc(x.title)}</h3><div class="card-meta">${formatViews(x.views||0)} views · <span class="card-likes">${formatViews(x.likes||0)} likes</span> · <span class="upload-age" title="${x.created_at?new Date(x.created_at).toLocaleString():''}">${formatUploadAge(x.created_at)}</span></div></div></a></article>`;
}
function setupPreviews(){document.querySelectorAll('.video-card').forEach(card=>{const video=card.querySelector('.preview-video');if(!video)return;let timer=null,previewing=false;const start=()=>{clearTimeout(timer);timer=setTimeout(()=>{video.currentTime=0;video.play().catch(()=>{});card.classList.add('previewing');previewing=true;},450)};const stop=()=>{clearTimeout(timer);timer=null;video.pause();video.currentTime=0;card.classList.remove('previewing');previewing=false};card.addEventListener('mouseenter',start);card.addEventListener('mouseleave',stop);card.addEventListener('touchstart',start,{passive:true});card.addEventListener('touchend',()=>{if(previewing)stop()},{passive:true});card.addEventListener('touchcancel',stop,{passive:true});});}
function renderPagination(total){const p=document.getElementById('pagination');if(!p)return;if(total<=1){p.innerHTML='';return;}let html=`<button class="btn" ${currentPage===1?'disabled':''} onclick="window.vexaPage(${currentPage-1})">Previous</button>`;for(let n=1;n<=total;n++)html+=`<button class="btn ${n===currentPage?'primary':''}" onclick="window.vexaPage(${n})">${n}</button>`;html+=`<button class="btn" ${currentPage===total?'disabled':''} onclick="window.vexaPage(${currentPage+1})">Next</button>`;p.innerHTML=html;}
window.vexaPage=async n=>{currentPage=Math.max(1,n);if(window.vexaServerVideoPage){await loadListing();}else renderGrid(currentList);window.scrollTo({top:0,behavior:'smooth'});};

async function renderHome(){
  const main=document.querySelector('.main');if(!main)return;
  main.innerHTML='<section class="home-section" id="homeVideosSection"><div class="section-title"><h1>Videos Being Watched</h1><button class="section-search-btn" id="homeSearchBtn" type="button" aria-label="Search videos" title="Search videos"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 5 5"></path></svg></button></div><div class="home-search" id="homeSearch" hidden><form id="homeSearchForm"><input id="homeSearchInput" type="search" placeholder="Search videos..." autocomplete="off"><button class="btn primary" type="submit">Search</button></form></div><div id="home-watched" class="grid home-grid"></div><div id="homePagination" class="pagination"></div></section><section class="home-section" id="homePhotosSection"><div class="section-title"><h1>Recent Photos</h1></div><div id="home-recent-photos" class="photo-grid home-photo-grid"></div><div id="homePhotoPagination" class="pagination"></div></section>';
  setupHomeSearch();
  let watched=window.vexaHomePageData||allVideos;
  if(!window.vexaHomePageData&&window.supabaseClient){try{const {data,count}=await window.supabaseClient.from('vexa_published_videos').select('*',{count:'exact'}).order('created_at',{ascending:false}).range((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE-1);if(Array.isArray(data)&&data.length){watched=data.map(normalizeVideo);window.vexaHomeCount=count||0;}}catch(e){}}
  const wg=document.getElementById('home-watched');
  if(wg){wg.innerHTML=watched.map(createCard).join('')||'<p class="muted">No videos found.</p>';const total=Math.max(1,Math.ceil((window.vexaHomeCount||watched.length)/PAGE_SIZE));const hp=document.getElementById('homePagination');if(hp){let h=`<button class="btn" ${currentPage===1?'disabled':''} onclick="window.vexaHomePage(${currentPage-1})">Previous</button>`;for(let n=1;n<=total;n++)h+=`<button class="btn ${n===currentPage?'primary':''}" onclick="window.vexaHomePage(${n})">${n}</button>`;h+=`<button class="btn" ${currentPage===total?'disabled':''} onclick="window.vexaHomePage(${currentPage+1})">Next</button>`;hp.innerHTML=h;}}
  await loadHomePhotos();setupPreviews();
}
window.vexaHomePage=async n=>{currentPage=Math.max(1,n);window.vexaHomePageData=null;document.getElementById('homePhotosSection')?.classList.toggle('is-hidden',currentPage>1);await renderHome();document.getElementById('homePhotosSection')?.classList.toggle('is-hidden',currentPage>1);window.scrollTo({top:0,behavior:'smooth'});};

photoPage=1;const PHOTO_PAGE_SIZE=20;
function demoPhotos(){return Array.from({length:40},(_,i)=>({id:`demo-${i+1}`,title:`Sample Photo ${i+1}`,image_url:`https://placehold.co/900x650/f0f0f0/222?text=Vexa+Photo+${i+1}`,thumbnail_url:`https://placehold.co/900x650/f0f0f0/222?text=Vexa+Photo+${i+1}`,views:300+i*41,likes:Math.max(0,80-i),dislikes:Math.max(0,10-Math.floor(i/5)),created_at:new Date(Date.now()-i*86400000).toISOString(),featured:i<8,trending:i%3===0}));}
async function fetchPhotos(){let rows=[];if(window.supabaseClient){const q=await window.supabaseClient.from('vexa_published_photos').select('*').order('created_at',{ascending:false}).limit(500);if(!q.error&&Array.isArray(q.data))rows=q.data;}return rows.length?rows:demoPhotos();}
function photoCard(p){return `<article class="card photo-card"><a href="photo.html?id=${encodeURIComponent(p.id)}"><div class="thumb"><img class="thumb-img" src="${vexaEsc(p.thumbnail_url||p.image_url||'')}" alt="${vexaEsc(p.title||'Photo')}" loading="lazy"></div><div class="card-body"><h3>${vexaEsc(p.title||'Untitled')}</h3><div class="card-meta">${formatViews(p.views||0)} views · <span class="photo-card-likes">${formatViews(p.likes||0)} likes</span> · ${formatUploadAge(p.created_at)}</div></div></a></article>`;}
async function loadHomePhotos(){const rows=await fetchPhotos();const recent=document.getElementById('home-recent-photos');if(!recent)return;recent.innerHTML=rows.slice(0,6).map(photoCard).join('')||'<p class="muted">No published photos yet.</p>';window._vexaHomePhotos=rows;const p=document.getElementById('homePhotoPagination');if(p){const total=Math.max(1,Math.ceil(rows.length/PHOTO_PAGE_SIZE));let h=`<button class="btn" disabled>Previous</button>`;for(let n=1;n<=total;n++)h+=`<button class="btn ${n===1?'primary':''}" onclick="window.vexaHomePhotoPage(${n})">${n}</button>`;h+=`<button class="btn" ${total===1?'disabled':''} onclick="window.vexaHomePhotoPage(2)">Next</button>`;p.innerHTML=h;}}
window.vexaHomePhotoPage=async n=>{const rows=window._vexaHomePhotos||await fetchPhotos();const total=Math.max(1,Math.ceil(rows.length/PHOTO_PAGE_SIZE));const page=Math.max(1,Math.min(n,total));const start=(page-1)*PHOTO_PAGE_SIZE;document.getElementById('homeVideosSection')?.classList.toggle('is-hidden',page>1);document.getElementById('homePhotosSection')?.classList.remove('is-hidden');const grid=document.getElementById('home-recent-photos');if(grid)grid.innerHTML=rows.slice(start,start+PHOTO_PAGE_SIZE).map(photoCard).join('');const p=document.getElementById('homePhotoPagination');if(p){let h=`<button class="btn" ${page===1?'disabled':''} onclick="window.vexaHomePhotoPage(${page-1})">Previous</button>`;for(let i=1;i<=total;i++)h+=`<button class="btn ${i===page?'primary':''}" onclick="window.vexaHomePhotoPage(${i})">${i}</button>`;h+=`<button class="btn" ${page===total?'disabled':''} onclick="window.vexaHomePhotoPage(${page+1})">Next</button>`;p.innerHTML=h;}window.scrollTo({top:0,behavior:'smooth'});};

async function loadPhotosPage(){const grid=document.getElementById('photoGrid');if(!grid)return;photoList=await fetchPhotos();photoPage=1;const main=document.querySelector('.main');main.innerHTML='<section class="home-section"><div class="section-title"><h1>Recent Photos</h1></div><div id="photoGrid" class="photo-grid"></div><div id="photoPagination" class="pagination"></div></section><section class="home-section"><div class="section-title"><h1>Trending Photos</h1></div><div id="trendingPhotoGrid" class="photo-grid"></div></section>';renderPhotoPage();document.getElementById('trendingPhotoGrid').innerHTML=[...photoList].sort((a,b)=>Number(b.views||0)-Number(a.views||0)).slice(0,12).map(photoCard).join('');}
function renderPhotoPage(){const grid=document.getElementById('photoGrid'),pager=document.getElementById('photoPagination');if(!grid)return;const total=Math.max(1,Math.ceil(photoList.length/PHOTO_PAGE_SIZE));photoPage=Math.min(photoPage,total);const start=(photoPage-1)*PHOTO_PAGE_SIZE;grid.innerHTML=photoList.slice(start,start+PHOTO_PAGE_SIZE).map(photoCard).join('')||'<p class="muted">No published photos yet.</p>';if(pager){let h=`<button class="btn" ${photoPage===1?'disabled':''} onclick="window.vexaPhotoPage(${photoPage-1})">Previous</button>`;for(let n=1;n<=total;n++)h+=`<button class="btn ${n===photoPage?'primary':''}" onclick="window.vexaPhotoPage(${n})">${n}</button>`;h+=`<button class="btn" ${photoPage===total?'disabled':''} onclick="window.vexaPhotoPage(${photoPage+1})">Next</button>`;pager.innerHTML=h;}}
window.vexaPhotoPage=n=>{photoPage=Math.max(1,n);renderPhotoPage();window.scrollTo({top:0,behavior:'smooth'});};

async function renderPhotoPageDetail(){
  const box=document.getElementById('photoPage'),id=new URLSearchParams(location.search).get('id');if(!box||!id)return;
  let p=null;if(window.supabaseClient){const q=await window.supabaseClient.from('vexa_published_photos').select('*').eq('id',id).maybeSingle();if(!q.error)p=q.data;}if(!p)p=demoPhotos().find(x=>String(x.id)===String(id));
  if(!p){box.innerHTML='<div class="form"><h1>Photo not found</h1><a class="btn" href="photos.html">Back to Photos</a></div>';return;}
  const image=p.image_url||p.thumbnail_url||'';
  box.innerHTML=`<article class="photo-detail"><div class="photo-detail-image"><img src="${vexaEsc(image)}" alt="${vexaEsc(p.title||'Photo')}"></div><div class="photo-detail-info"><h1>${vexaEsc(p.title||'Untitled')}</h1><div class="video-top-meta"><span class="muted">${formatViews(p.views||0)} views</span><span class="muted upload-age">${formatUploadAge(p.created_at)}</span></div>${p.description?`<p>${vexaEsc(p.description)}</p>`:''}<div class="tags">${(Array.isArray(p.tags)?p.tags:[]).map(t=>`<a class="tag-link" href="tags.html?tag=${encodeURIComponent(t)}">${vexaEsc(t)}</a>`).join('')}</div></div><div class="actions photo-actions"><button class="action-btn" id="photoLikeBtn">${icon.like}<span>Like</span><strong class="action-count">${formatViews(p.likes||0)}</strong></button><button class="action-btn" id="photoDislikeBtn">${icon.dislike}<span>Dislike</span><strong class="action-count">${formatViews(p.dislikes||0)}</strong></button><button class="action-btn" id="photoCommentBtn">${icon.comment}<span>Comments</span></button><a class="action-btn" href="${vexaEsc(image)}" download>${icon.download}<span>Download</span></a><button class="action-btn" id="photoSaveBtn">${icon.save}<span>Save</span></button><button class="action-btn" id="photoShareBtn">${icon.share}<span>Share</span></button><a class="action-btn" href="report.html?photo=${encodeURIComponent(p.id)}">${icon.report}<span>Report</span></a></div><section class="related-wrap"><h2>Trending Photos</h2><div class="photo-grid" id="photoTrendingGrid"></div></section><a class="btn" href="photos.html">Back to Photos</a></article>`;
  await setupPhotoReactions(p.id);
  setupPhotoShare(p);setupPhotoSave(p);
  document.getElementById('photoCommentBtn').onclick=()=>alert('Photo comments are not available on this photo yet.');
  const trend=await fetchPhotos();document.getElementById('photoTrendingGrid').innerHTML=[...trend].sort((a,b)=>Number(b.views||0)-Number(a.views||0)).filter(x=>String(x.id)!==String(p.id)).slice(0,12).map(photoCard).join('')||'<p class="muted">No trending photos yet.</p>';
}
async function setupPhotoReactions(id){const lb=document.getElementById('photoLikeBtn'),db=document.getElementById('photoDislikeBtn');if(!lb||!db||!window.supabaseClient)return;const send=async reaction=>{const {data,error}=await window.supabaseClient.rpc('set_photo_reaction',{p_photo_id:Number(id),p_reaction:reaction});if(error){alert(error.message);return;}lb.querySelector('.action-count').textContent=formatViews(data.likes);db.querySelector('.action-count').textContent=formatViews(data.dislikes);document.querySelectorAll('.photo-card').forEach(card=>{if(card.querySelector(`a[href="photo.html?id=${encodeURIComponent(id)}"]`)){const count=card.querySelector('.photo-card-likes');if(count)count.textContent=`${formatViews(data.likes)} likes`;}});};lb.onclick=()=>send('like');db.onclick=()=>send('dislike');}
function setupPhotoShare(p){const b=document.getElementById('photoShareBtn');if(!b)return;b.onclick=async()=>{const url=location.href;if(navigator.share){try{await navigator.share({title:p.title||'Photo',url});return;}catch(e){}}try{await navigator.clipboard.writeText(url);alert('Link copied.');}catch(e){prompt('Copy this link:',url);}};}
function setupPhotoSave(p){const b=document.getElementById('photoSaveBtn');if(!b)return;let saved=localStorage.getItem('vexa-saved-photo-'+p.id)==='1';b.classList.toggle('primary',saved);b.onclick=()=>{saved=!saved;localStorage.setItem('vexa-saved-photo-'+p.id,saved?'1':'0');b.classList.toggle('primary',saved);};}

document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('photoPage'))renderPhotoPageDetail();});
