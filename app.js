const VEXA_LOCAL = window.VEXA_VIDEOS || [];
const PAGE_SIZE = 30;
let allVideos = [...VEXA_LOCAL];
let currentPage = Number(new URLSearchParams(location.search).get('page')) || 1;
let activeSearch = '';
let activeCategory = new URLSearchParams(location.search).get('category') || '';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

window.addEventListener('DOMContentLoaded', init);

async function init() {
  setupTheme();
  setupMenu();
  setupHeaderAuth();
  setupSearch();
  setupLanguage();

  if ($('#videoPage')) return renderVideoPage();
  if ($('#videoGrid')) return loadListing();
  if ($('#photoGrid')) return loadPhotoListing();
}

function setupTheme() {
  const saved = localStorage.getItem('vexa-theme');
  if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
  const button = $('#themeBtn');
  if (!button) return;
  updateThemeButton(button);
  button.onclick = () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('vexa-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    updateThemeButton(button);
  };
}
function updateThemeButton(button) { button.textContent = document.documentElement.classList.contains('dark') ? 'Light' : 'Dark'; }

function setupMenu() {
  const button = $('#menuBtn'), overlay = $('#overlay');
  if (button) button.onclick = () => document.body.classList.toggle('menu-open');
  if (overlay) overlay.onclick = () => document.body.classList.remove('menu-open');
}

function setupLanguage() {
  const select = $('#languageSelect');
  if (!select) return;
  const saved = localStorage.getItem('vexa-language') || 'EN';
  select.value = saved;
  select.onchange = () => localStorage.setItem('vexa-language', select.value);
}

async function setupHeaderAuth() {
  const target = $('#authNav');
  if (!target || !window.supabaseClient) return;
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  renderAuthNav(target, session);
  window.supabaseClient.auth.onAuthStateChange((_event, newSession) => renderAuthNav(target, newSession));
}

function renderAuthNav(target, session) {
  if (!session) {
    target.innerHTML = '<a class="header-account" href="login.html">Log in</a>';
    return;
  }
  const email = session.user.email || 'Account';
  const label = (session.user.user_metadata?.display_name || session.user.user_metadata?.username || email.split('@')[0] || 'Account');
  target.innerHTML = `<details class="account-menu"><summary class="header-account">${esc(label)}</summary><div class="account-popover"><small>${esc(email)}</small><a href="profile.html">Profile</a><button id="logoutBtn">Log out</button></div></details>`;
  $('#logoutBtn', target).onclick = async () => { await window.supabaseClient.auth.signOut(); location.reload(); };
}

function setupSearch() {
  const input = $('#searchInput');
  if (!input) return;
  input.value = new URLSearchParams(location.search).get('q') || '';
  input.addEventListener('input', () => {
    activeSearch = input.value.trim().toLowerCase();
    currentPage = 1;
    renderGrid(getFilteredVideos());
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      location.href = q ? `videos.html?q=${encodeURIComponent(q)}` : 'videos.html';
    }
  });
}

async function loadListing() {
  allVideos = [...VEXA_LOCAL];
  if (window.supabaseClient) {
    const { data, error } = await window.supabaseClient.from('latest_videos').select('*').limit(200);
    if (!error && data?.length) allVideos = data.map(normalizeVideo);
  }
  const q = new URLSearchParams(location.search).get('q') || '';
  activeSearch = q.toLowerCase();
  renderGrid(getFilteredVideos());
}

function normalizeVideo(v) {
  return {
    ...v,
    id: v.id,
    title: v.title || 'Untitled video',
    thumbnail: v.thumbnail_url || v.thumbnail || 'https://placehold.co/1280x720?text=Vexa',
    video: v.video_url || v.video || '',
    preview: v.preview_url || v.preview || v.video_url || v.video || '',
    download: v.download_url || v.download || v.video_url || v.video || '',
    category: v.category_name || v.category || 'Video',
    tags: Array.isArray(v.tags) ? v.tags : (typeof v.tags === 'string' ? v.tags.split(',').map(x => x.trim()).filter(Boolean) : []),
    views: Number(v.views || 0),
    likes: Number(v.likes || 0),
    dislikes: Number(v.dislikes || 0),
    description: v.description || '',
    duration: v.duration || ''
  };
}

function getFilteredVideos() {
  return allVideos.filter(v => {
    const x = normalizeVideo(v);
    const matchesSearch = !activeSearch || `${x.title} ${x.category} ${x.tags.join(' ')} ${x.description}`.toLowerCase().includes(activeSearch);
    const matchesCategory = !activeCategory || x.category.toLowerCase() === activeCategory.toLowerCase() || String(x.category).toLowerCase().includes(activeCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });
}

function renderGrid(list = allVideos) {
  const grid = $('#videoGrid');
  if (!grid) return;
  const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), total);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);
  grid.innerHTML = pageItems.map(createCard).join('') || '<div class="empty-state"><h3>No videos found</h3><p>Try another search or category.</p></div>';
  setupPreviews();
  renderPagination(total, list.length);
  const counter = $('#pageSummary');
  if (counter) counter.textContent = list.length ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} of ${list.length} videos` : 'No videos found';
}

function createCard(v) {
  const x = normalizeVideo(v);
  const id = encodeURIComponent(x.id ?? x.title);
  return `<article class="card video-card" data-id="${esc(x.id)}">
    <a class="video-link" href="video.html?id=${id}">
      <div class="thumb preview-wrap">
        <img class="thumb-img" src="${esc(x.thumbnail)}" alt="${esc(x.title)}" loading="lazy">
        ${x.preview ? `<video class="preview-video" muted playsinline preload="metadata" src="${esc(x.preview)}"></video>` : ''}
        <span class="play-badge">Play</span>
        ${x.duration ? `<span class="duration">${esc(x.duration)}</span>` : ''}
      </div>
      <div class="card-body"><h3>${esc(x.title)}</h3><div class="muted">${formatViews(x.views)} views</div><div class="card-category">${esc(x.category)}</div></div>
    </a>
  </article>`;
}

function setupPreviews() {
  $$('.video-card').forEach(card => {
    const video = $('.preview-video', card);
    if (!video) return;
    let timer = null;
    let previewing = false;
    let pointerStart = null;

    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        previewing = true;
        video.currentTime = 0;
        video.play().catch(() => {});
        card.classList.add('is-previewing');
      }, 550);
    };
    const stop = () => {
      clearTimeout(timer);
      timer = null;
      video.pause();
      try { video.currentTime = 0; } catch (_) {}
      previewing = false;
      card.classList.remove('is-previewing');
    };

    card.addEventListener('mouseenter', start);
    card.addEventListener('mouseleave', stop);
    card.addEventListener('pointerdown', e => { pointerStart = {x:e.clientX, y:e.clientY}; start(); }, {passive:true});
    card.addEventListener('pointerup', e => {
      if (previewing) { e.preventDefault(); e.stopPropagation(); }
      stop();
    }, {passive:false});
    card.addEventListener('pointercancel', stop, {passive:true});
    card.addEventListener('pointermove', e => {
      if (!pointerStart) return;
      if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 12) stop();
    }, {passive:true});
  });
}

function renderPagination(total, count) {
  const p = $('#pagination');
  if (!p) return;
  if (total <= 1) { p.innerHTML = ''; return; }
  const numbers = paginationNumbers(total, currentPage);
  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="vexaPage(${currentPage - 1})">Previous</button>`;
  numbers.forEach(n => html += n === '…' ? '<span class="page-dots">…</span>' : `<button class="page-btn ${n === currentPage ? 'active' : ''}" onclick="vexaPage(${n})">${n}</button>`);
  html += `<button class="page-btn" ${currentPage === total ? 'disabled' : ''} onclick="vexaPage(${currentPage + 1})">Next</button>`;
  p.innerHTML = html;
}
function paginationNumbers(total, current) {
  if (total <= 7) return Array.from({length:total}, (_,i)=>i+1);
  const out = [1];
  if (current > 4) out.push('…');
  for (let n=Math.max(2,current-2); n<=Math.min(total-1,current+2); n++) out.push(n);
  if (current < total-3) out.push('…');
  out.push(total);
  return out;
}
window.vexaPage = n => {
  currentPage = Number(n);
  const params = new URLSearchParams(location.search);
  params.set('page', currentPage);
  history.replaceState(null, '', `${location.pathname}?${params}`);
  renderGrid(getFilteredVideos());
  window.scrollTo({top:0, behavior:'smooth'});
};

async function findVideo(id) {
  let v = allVideos.find(x => String(x.id) === String(id));
  if (!v && window.VEXA_VIDEOS) v = window.VEXA_VIDEOS.find(x => String(x.id) === String(id));
  if (window.supabaseClient && id) {
    const { data } = await window.supabaseClient.from('videos').select('*').eq('id', id).maybeSingle();
    if (data) v = normalizeVideo(data);
  }
  return v ? normalizeVideo(v) : null;
}

async function renderVideoPage() {
  const box = $('#videoPage');
  const id = new URLSearchParams(location.search).get('id');
  const v = await findVideo(id);
  if (!v) { box.innerHTML = '<div class="empty-state"><h1>Video not found</h1><a class="btn primary" href="videos.html">Back to videos</a></div>'; return; }
  document.title = `Vexa — ${v.title}`;
  box.innerHTML = `<div class="video-detail">
    <div class="player-wrap"><video class="main-player" controls playsinline poster="${esc(v.thumbnail)}" src="${esc(v.video)}"></video></div>
    <div class="video-info">
      <div class="eyebrow">${esc(v.category)}</div>
      <h1>${esc(v.title)}</h1>
      <div class="video-meta">${formatViews(v.views)} views${v.duration ? ` · ${esc(v.duration)}` : ''}</div>
      <div class="actions">
        <button class="btn" id="likeBtn">Like <span>${v.likes}</span></button>
        <button class="btn" id="dislikeBtn">Dislike <span>${v.dislikes}</span></button>
        <button class="btn" id="saveBtn">Save</button>
        <button class="btn" id="shareBtn">Share</button>
      </div>
      <div class="tags">${v.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>
      <div class="description"><h2>Description</h2><p>${esc(v.description || 'No description provided.')}</p></div>
    </div>
  </div>
  <section class="comments-section"><div class="section-title"><h2>Comments</h2></div><form class="comment-form" id="commentForm"><textarea id="commentInput" rows="3" placeholder="Write a comment..." required></textarea><button class="btn primary" type="submit">Post comment</button></form><div id="commentsList"></div></section>
  <section class="related-section"><div class="section-title"><h2>Related videos</h2><a class="muted" href="videos.html">View all</a></div><div class="grid related-grid" id="relatedGrid"></div></section>`;
  setupReactions(v);
  setupSave(v);
  setupShare(v);
  setupComments(v);
  loadRelated(v);
  incrementView(v.id);
}

async function incrementView(id) {
  if (!window.supabaseClient) return;
  try { await window.supabaseClient.rpc('record_video_view', {p_video_id:Number(id)}); } catch (_) {}
}

function setupReactions(v) {
  const like = $('#likeBtn'), dislike = $('#dislikeBtn');
  const localKey = `vexa-reaction-${v.id}`;
  const local = localStorage.getItem(localKey);
  if (local) (local === 'like' ? like : dislike)?.classList.add('selected');
  const send = async reaction => {
    if (window.supabaseClient) {
      const {data,error} = await window.supabaseClient.rpc('set_video_reaction',{p_video_id:Number(v.id),p_reaction:reaction});
      if (!error && data) { like.querySelector('span').textContent=data.likes; dislike.querySelector('span').textContent=data.dislikes; }
      else alert(error?.message || 'Please sign in to react.');
    } else {
      const previous = localStorage.getItem(localKey);
      localStorage.setItem(localKey, previous === reaction ? '' : reaction);
      like.classList.toggle('selected', reaction === 'like' && previous !== reaction);
      dislike.classList.toggle('selected', reaction === 'dislike' && previous !== reaction);
    }
  };
  like.onclick=()=>send('like'); dislike.onclick=()=>send('dislike');
}

function setupSave(v) {
  const b=$('#saveBtn'), key='vexa-saved-videos';
  const get=()=>JSON.parse(localStorage.getItem(key)||'[]');
  const refresh=()=>b.textContent=get().includes(String(v.id))?'Saved':'Save';
  refresh();
  b.onclick=()=>{const ids=get();const id=String(v.id);const i=ids.indexOf(id);i>=0?ids.splice(i,1):ids.push(id);localStorage.setItem(key,JSON.stringify(ids));refresh();};
}
function setupShare(v) {
  $('#shareBtn').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);alert('Video link copied.');}catch(_){prompt('Copy this link:',location.href);}};
}

async function setupComments(v) {
  const form=$('#commentForm'), input=$('#commentInput'), list=$('#commentsList');
  renderLocalComments(v.id,list);
  form.onsubmit=async e=>{
    e.preventDefault();
    const text=input.value.trim(); if(!text)return;
    let saved=false;
    if(window.supabaseClient){
      const {data:{user}}=await window.supabaseClient.auth.getUser();
      if(user){
        const {error}=await window.supabaseClient.from('comments').insert({video_id:v.id,user_id:user.id,body:text});
        if(!error){saved=true; input.value=''; await loadCommentsFromDb(v.id,list);}
      }
    }
    if(!saved){
      const key=`vexa-comments-${v.id}`;const comments=JSON.parse(localStorage.getItem(key)||'[]');comments.unshift({body:text,created_at:new Date().toISOString(),author:'You'});localStorage.setItem(key,JSON.stringify(comments));input.value='';renderLocalComments(v.id,list);}
  };
  await loadCommentsFromDb(v.id,list);
}
async function loadCommentsFromDb(id,list){
  if(!window.supabaseClient)return;
  try{const {data,error}=await window.supabaseClient.from('comments').select('*').eq('video_id',id).order('created_at',{ascending:false}).limit(50);if(!error&&data?.length){list.innerHTML=data.map(c=>`<div class="comment"><strong>${esc(c.author_name||'Member')}</strong><p>${esc(c.body||c.content||'')}</p></div>`).join('');}}catch(_){}
}
function renderLocalComments(id,list){const comments=JSON.parse(localStorage.getItem(`vexa-comments-${id}`)||'[]');if(!comments.length){list.innerHTML='<p class="muted">Be the first to comment.</p>';return;}list.innerHTML=comments.map(c=>`<div class="comment"><strong>${esc(c.author||'You')}</strong><p>${esc(c.body)}</p></div>`).join('');}

function loadRelated(v) {
  const grid=$('#relatedGrid');if(!grid)return;
  const related=allVideos.filter(x=>String(x.id)!==String(v.id)).sort((a,b)=>Number(b.views||0)-Number(a.views||0)).slice(0,8);
  grid.innerHTML=related.map(createCard).join(''); setupPreviews();
}

function formatViews(n){return Number(n||0).toLocaleString();}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}


const PHOTO_PAGE_SIZE = 30;
const PHOTO_CATEGORIES = ['Travel','Nature','Lifestyle','Technology','Sports','Automotive','Food','Education'];
const PHOTO_TITLES = [
  'Beautiful Coast','Mountain Morning','City Lights','Forest Trail','Ocean Horizon','Golden Sunset','Modern Workspace','Street Scene','Tropical Escape','Quiet Lake',
  'Desert Road','Green Valley','Rainy Street','Beach Walk','Night Skyline','Wild River','Open Road','Garden Morning','Island View','Winter Landscape',
  'Coffee Moment','Creative Desk','Fitness Session','Game Setup','Fresh Meal','Study Corner','Dream Car','Basketball Court','Travel Backpack','Sunrise View',
  'Seaside Town','Forest Path','Mountain Road','Urban Architecture','Calm Waters','Evening Drive','Nature Close Up','Weekend Market','Outdoor Adventure','Home Studio',
  'Healthy Plate','Coding Desk','Football Field','Coastal Road','Sunset Beach','Wildlife Scene','City Morning','Adventure Trail','Ocean Waves','Cloudy Peaks',
  'Creator Setup','Road Trip','Local Market','Peaceful Garden','Sports Training','Modern Gadgets','Lake Reflection','Evening City','Hiking View','Sunlit Forest'
];
function photoItems(){
  return PHOTO_TITLES.map((title,i)=>({id:i+1,title,category:PHOTO_CATEGORIES[i%PHOTO_CATEGORIES.length],views:120+i*19,src:`https://picsum.photos/seed/vexa-photo-${i+1}/900/600`}));
}
function loadPhotoListing(){
  const items=photoItems();
  const params=new URLSearchParams(location.search);
  let page=Number(params.get('page'))||1;
  const q=(params.get('q')||'').trim().toLowerCase();
  const filtered=q?items.filter(x=>`${x.title} ${x.category}`.toLowerCase().includes(q)):items;
  const total=Math.max(1,Math.ceil(filtered.length/PHOTO_PAGE_SIZE));
  page=Math.min(Math.max(page,1),total);
  const start=(page-1)*PHOTO_PAGE_SIZE;
  const grid=$('#photoGrid');
  grid.innerHTML=filtered.slice(start,start+PHOTO_PAGE_SIZE).map(createPhotoCard).join('')||'<div class="empty-state"><h3>No photos found</h3><p>Try another search.</p></div>';
  const summary=$('#photoSummary');
  if(summary) summary.textContent=filtered.length?`Showing ${start+1}–${Math.min(start+PHOTO_PAGE_SIZE,filtered.length)} of ${filtered.length} photos`:'No photos found';
  renderPhotoPagination(total,page);
}
function createPhotoCard(x){
  return `<article class="card photo-card"><a href="photos.html?page=${Math.ceil(x.id/PHOTO_PAGE_SIZE)}"><div class="photo-thumb"><img src="${esc(x.src)}" alt="${esc(x.title)}" loading="lazy"></div><div class="card-body"><h3>${esc(x.title)}</h3><div class="muted">${formatViews(x.views)} views</div><div class="card-category">${esc(x.category)}</div></div></a></article>`;
}
function renderPhotoPagination(total,page){
  const p=$('#photoPagination'); if(!p)return;
  if(total<=1){p.innerHTML='';return;}
  const nums=paginationNumbers(total,page);
  let html=`<button class="page-btn" ${page===1?'disabled':''} onclick="photoPage(${page-1})">Previous</button>`;
  nums.forEach(n=>html+=n==='…'?'<span class="page-dots">…</span>':`<button class="page-btn ${n===page?'active':''}" onclick="photoPage(${n})">${n}</button>`);
  html+=`<button class="page-btn" ${page===total?'disabled':''} onclick="photoPage(${page+1})">Next</button>`;
  p.innerHTML=html;
}
window.photoPage=n=>{const params=new URLSearchParams(location.search);params.set('page',n);history.replaceState(null,'',`${location.pathname}?${params}`);loadPhotoListing();window.scrollTo({top:0,behavior:'smooth'});};
