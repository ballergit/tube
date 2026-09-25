(function(){
 const root=document.documentElement;
 const saved=localStorage.getItem('theme');
 if(saved==='dark') root.classList.add('dark');
 const lang=localStorage.getItem('lang')||'en';

 async function loadLatestVideos(){
  const grid=document.querySelector('[data-video-grid]');
  if(!grid || !window.supabaseClient) return;
  try{
   const {data,error}=await window.supabaseClient
    .from('videos')
    .select('id,title,description,video_url,thumbnail_url,views,created_at,status')
    .eq('status','published')
    .order('created_at',{ascending:false})
    .limit(12);
   if(error) throw error;
   if(!data || !data.length){
    grid.innerHTML='<p class="muted">No published videos yet.</p>';
    return;
   }
   grid.innerHTML=data.map(video=>{
    const title=escapeHtml(video.title||'Untitled video');
    const desc=escapeHtml(video.description||'Authorized content');
    const thumb=video.thumbnail_url ? `<img src="${escapeAttr(video.thumbnail_url)}" alt="${title}" loading="lazy">` : '<div class="thumb">▶</div>';
    return `<article class="card"><div class="thumb-wrap">${thumb}</div><div class="card-body"><h3>${title}</h3><p class="muted">${desc}</p><p class="muted">${Number(video.views||0).toLocaleString()} views</p><a class="btn" href="video.html?id=${encodeURIComponent(video.id)}">Watch</a></div></article>`;
   }).join('');
  }catch(err){
   console.error('Supabase video query failed:',err);
   grid.innerHTML='<p class="muted">Videos could not be loaded. Check your Supabase table, RLS policy, and API configuration.</p>';
  }
 }
 function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
 function escapeAttr(v){return escapeHtml(v);}

 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{root.classList.toggle('dark');localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light')}));
  document.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('menu-open')));
  document.querySelectorAll('[data-overlay]').forEach(x=>x.addEventListener('click',()=>document.body.classList.remove('menu-open')));
  document.querySelectorAll('[data-lang]').forEach(s=>{s.value=lang;s.addEventListener('change',()=>localStorage.setItem('lang',s.value))});
  const page=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.side-link').forEach(a=>{if(a.getAttribute('href')===page)a.classList.add('active')});
  loadLatestVideos();
 });
})();
