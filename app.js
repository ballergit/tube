const VEXA_LOCAL = window.VEXA_VIDEOS || [];
const PAGE_SIZE = 30;
const PHOTO_PAGE_SIZE = 30;
let allVideos = [...VEXA_LOCAL];
let currentPage = Number(new URLSearchParams(location.search).get('page')) || 1;
let activeSearch = '';
let activeCategory = new URLSearchParams(location.search).get('category') || '';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

window.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSiteSettings();
  setupTheme();
  setupHeaderAuth();
  setupSearch();
  setupLanguage();

  setActiveSidebar();
  if ($('#videoPage')) return renderVideoPage();
  if ($('#photoGrid')) return loadPhotoListing();
  if ($('#videoGrid')) return loadListing();
}

async function loadSiteSettings() {
  const defaults = {site_name:'Vexa',site_description:'Responsive video and photo platform',site_copyright:'© 2026 Vexa — Authorized and demo content only.',accent:'#7c3aed',accent2:'#38bdf8',dark_bg:'#08090b',dark_surface:'#111318',light_bg:'#f5f6f8',light_surface:'#ffffff'};
  let settings = {...defaults};
  if (window.supabaseClient) {
    try {
      const {data} = await window.supabaseClient.from('site_settings').select('key,value');
      (data || []).forEach(row => { settings[row.key] = row.value; });
    } catch (_) {}
  }
  document.documentElement.style.setProperty('--accent', settings.accent);
  document.documentElement.style.setProperty('--accent2', settings.accent2);
  document.documentElement.style.setProperty('--dark-bg', settings.dark_bg);
  document.documentElement.style.setProperty('--dark-surface', settings.dark_surface);
  document.documentElement.style.setProperty('--light-bg', settings.light_bg);
  document.documentElement.style.setProperty('--light-surface', settings.light_surface);
  document.querySelectorAll('.brand').forEach(el => { if (!el.closest('.admin-main')) el.textContent = settings.site_name; });
  document.querySelectorAll('.copyright').forEach(el => el.textContent = settings.site_copyright);
  if (settings.site_name) document.title = document.title.replace(/^Vexa/, settings.site_name);
}

function setupTheme() {
  const saved = localStorage.getItem('vexa-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  document.documentElement.classList.toggle('dark', isDark);

  const button = document.getElementById('themeBtn');
  if (!button) return;
  updateThemeButton(button);

  button.addEventListener('click', () => {
    const nextDark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', nextDark);
    localStorage.setItem('vexa-theme', nextDark ? 'dark' : 'light');
    updateThemeButton(button);
  });
}

function updateThemeButton(button) {
  const dark = document.documentElement.classList.contains('dark');
  button.textContent = dark ? '☀️' : '🌙';
  button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  button.setAttribute('title', dark ? 'Light mode' : 'Dark mode');
}

function setActiveSidebar() {
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.side-link').forEach(link => {
    const href = (link.getAttribute('href') || '').split('?')[0];
    link.classList.toggle('active', href === page || (page === 'index.html' && href === 'index.html'));
  });
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
  const adminLink = session.user.app_metadata?.role === 'admin' ? '<a href="admin.html">Admin Dashboard</a>' : '';
  target.innerHTML = `<details class="account-menu"><summary class="header-account">${esc(label)}</summary><div class="account-popover"><small>${esc(email)}</small><a href="profile.html">Profile</a>${adminLink}<button id="logoutBtn">Log out</button></div></details>`;
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
      const target = $('#photoGrid') ? 'photos.html' : 'videos.html';
      location.href = q ? `${target}?q=${encodeURIComponent(q)}` : target;
    }
  });
}

async function loadListing() {
  allVideos = [...VEXA_LOCAL];
  if (window.supabaseClient) {
    const { data, error } = await window.supabaseClient.from('latest_videos').select('*').order('created_at', {ascending:false}).limit(500);
    if (!error && data?.length) {
      const remote = data.map(normalizeVideo);
      const byId = new Map(remote.map(v => [String(v.id), v]));
      for (const demo of VEXA_LOCAL) if (!byId.has(String(demo.id))) byId.set(String(demo.id), demo);
      allVideos = [...byId.values()];
    }
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
    duration: v.duration || '',
    created_at: v.created_at || v.published_at || ''
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
  setupCardInteractions();
  renderPagination(total, list.length);
  const counter = $('#pageSummary');
  if (counter) counter.textContent = list.length ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} of ${list.length} videos` : 'No videos found';
}

function createCard(v) {
  const x = normalizeVideo(v);
  const id = encodeURIComponent(x.id ?? x.title);
  return `<article class="card video-card" data-id="${esc(x.id)}">
    <div class="video-card-link" data-open-video="video.html?id=${id}">
      <div class="thumb preview-wrap">
        <img class="thumb-img" src="${esc(x.thumbnail)}" alt="${esc(x.title)}" loading="lazy">
        ${x.preview || x.video ? `<video class="preview-video" muted playsinline preload="metadata" src="${esc(x.preview || x.video)}"></video>` : ''}
        <button class="card-play" type="button" aria-label="Play ${esc(x.title)}">▶</button>
        <span class="duration">${esc(x.duration || '')}</span>
      </div>
      <div class="card-body"><h3>${esc(x.title)}</h3><div class="muted card-meta">${formatViews(x.views)} views</div><div class="card-category">${esc(x.category)}</div></div>
    </div>
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

function setupCardInteractions() {
  $$('.video-card').forEach(card => {
    const open = card.querySelector('[data-open-video]');
    const play = card.querySelector('.card-play');
    const video = card.querySelector('.preview-video');
    if (!open) return;
    open.addEventListener('click', e => {
      if (e.target.closest('.card-play')) return;
      location.href = open.dataset.openVideo;
    });
    if (play && video) {
      play.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        if (video.paused) { video.controls = true; video.muted = false; video.play().catch(()=>{}); card.classList.add('is-playing'); play.textContent='❚❚'; }
        else { video.pause(); video.controls = false; play.textContent='▶'; card.classList.remove('is-playing'); }
      });
      video.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      video.addEventListener('ended', () => { video.controls=false; play.textContent='▶'; card.classList.remove('is-playing'); });
    }
  });
}

async function loadPhotoListing() {
  let photos = [...(window.VEXA_PHOTOS || [])];
  if (window.supabaseClient) {
    try {
      const {data} = await window.supabaseClient.from('photos').select('*,categories(name)').eq('status','published').order('created_at',{ascending:false}).limit(500);
      if (data?.length) {
        const remote=data.map(p=>({id:p.id,title:p.title,description:p.description||'',image:p.image_url,category:p.categories?.name||'Photo',views:Number(p.views||0),created_at:p.created_at}));
        const ids=new Set(remote.map(p=>String(p.id))); photos=[...remote,...photos.filter(p=>!ids.has(String(p.id)))];
      }
    } catch (_) {}
  }
  const q = new URLSearchParams(location.search).get('q') || '';
  const category = new URLSearchParams(location.search).get('category') || '';
  const filtered = photos.filter(p => {
    const hay = `${p.title} ${p.category} ${p.description}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (!category || String(p.category).toLowerCase().includes(category.toLowerCase()));
  });
  renderPhotoGrid(filtered);
}

function renderPhotoGrid(list) {
  const grid = $('#photoGrid');
  if (!grid) return;
  const total = Math.max(1, Math.ceil(list.length / PHOTO_PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), total);
  const start = (currentPage - 1) * PHOTO_PAGE_SIZE;
  const pageItems = list.slice(start, start + PHOTO_PAGE_SIZE);
  grid.innerHTML = pageItems.map(createPhotoCard).join('') || '<div class="empty-state"><h3>No photos found</h3><p>Try another search or category.</p></div>';
  renderPagination(total, list.length);
  const counter = $('#pageSummary');
  if (counter) counter.textContent = list.length ? `Showing ${start + 1}–${Math.min(start + PHOTO_PAGE_SIZE, list.length)} of ${list.length} photos` : 'No photos found';
}

function createPhotoCard(x) {
  return `<article class="card photo-card"><a href="${esc(x.image)}" target="_blank" rel="noopener"><div class="thumb photo-thumb"><img class="thumb-img" src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy"></div><div class="card-body"><h3>${esc(x.title)}</h3><div class="muted card-meta">${formatViews(x.views)} views</div><div class="card-category">${esc(x.category)}</div></div></a></article>`;
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
  if ($('#photoGrid')) loadPhotoListing(); else renderGrid(getFilteredVideos());
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
        <button class="btn action-btn" id="likeBtn" type="button">👍 Like <span>${v.likes}</span></button>
        <button class="btn action-btn" id="dislikeBtn" type="button">👎 Dislike <span>${v.dislikes}</span></button>
        <a class="btn action-btn" id="downloadBtn" href="${esc(v.download || v.video)}" download target="_blank" rel="noopener">⬇ Download</a>
        <button class="btn action-btn" id="shareBtn" type="button">↗ Share</button>
      </div>
      <div class="tags">${v.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>
      <div class="description"><h2>Description</h2><p>${esc(v.description || 'No description provided.')}</p></div>
    </div>
  </div>
  <section class="comments-section"><div class="section-title"><h2>Comments</h2></div><form class="comment-form" id="commentForm"><textarea id="commentInput" rows="3" placeholder="Write a comment..." required></textarea><button class="btn primary" type="submit">Post comment</button></form><div id="commentsList"></div></section>
  <section class="related-section"><div class="section-title"><h2>Related videos</h2><a class="muted" href="videos.html">View all</a></div><div class="grid related-grid" id="relatedGrid"></div></section>`;
  setupReactions(v);
  setupDownload(v);
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

function setupDownload(v) {
  const b=$('#downloadBtn');
  if (!b) return;
  if (!v.download && !v.video) { b.removeAttribute('href'); b.classList.add('disabled'); b.setAttribute('aria-disabled','true'); }
}
function setupShare(v) {
  const b=$('#shareBtn'); if(!b)return;
  b.onclick=()=>openShareModal(v);
}
function openShareModal(v) {
  let modal=document.getElementById('shareModal');
  if(!modal){
    modal=document.createElement('div'); modal.id='shareModal'; modal.className='share-modal';
    modal.innerHTML=`<div class="share-dialog" role="dialog" aria-modal="true" aria-labelledby="shareTitle"><button class="share-close" type="button" aria-label="Close">×</button><h2 id="shareTitle">Share video</h2><p class="muted share-url"></p><div class="share-options"></div></div>`;
    document.body.appendChild(modal); modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();}); modal.querySelector('.share-close').onclick=()=>modal.remove();
  }
  const url=location.href, title=v.title;
  modal.querySelector('.share-url').textContent=url;
  const encoded=encodeURIComponent(url), text=encodeURIComponent(title+' — '+url);
  modal.querySelector('.share-options').innerHTML=`
    <a class="share-option" href="https://wa.me/?text=${text}" target="_blank" rel="noopener">WhatsApp</a>
    <a class="share-option" href="https://t.me/share/url?url=${encoded}&text=${encodeURIComponent(title)}" target="_blank" rel="noopener">Telegram</a>
    <a class="share-option" href="https://www.facebook.com/sharer/sharer.php?u=${encoded}" target="_blank" rel="noopener">Facebook</a>
    <a class="share-option" href="https://twitter.com/intent/tweet?text=${text}" target="_blank" rel="noopener">X</a>
    <a class="share-option" href="mailto:?subject=${encodeURIComponent(title)}&body=${text}">Email</a>
    <button class="share-option copy-share" type="button">Copy link</button>`;
  modal.querySelector('.copy-share').onclick=async()=>{try{await navigator.clipboard.writeText(url);modal.querySelector('.copy-share').textContent='Copied ✓';setTimeout(()=>{if(document.body.contains(modal))modal.remove();},700);}catch(_){prompt('Copy this link:',url);}};
  modal.hidden=false;
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
  grid.innerHTML=related.map(createCard).join(''); setupPreviews(); setupCardInteractions();
}

function formatViews(n){return Number(n||0).toLocaleString();}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
