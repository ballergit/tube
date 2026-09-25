(function(){
  const root=document.documentElement;
  const saved=localStorage.getItem('theme');
  if(saved==='dark') root.classList.add('dark');
  const lang=localStorage.getItem('lang')||'en';

  let supabaseClient = null;
  function getSupabase(){
    if(supabaseClient) return supabaseClient;
    if(window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY){
      supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
    return supabaseClient;
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function videoCard(v){
    const title=escapeHtml(v.title || 'Untitled video');
    const description=escapeHtml(v.description || 'Authorized content');
    const thumb=v.thumbnail_url || v.thumbnail || '';
    const thumbHtml=thumb
      ? `<div class="thumb"><img src="${escapeHtml(thumb)}" alt="${title}" loading="lazy"></div>`
      : `<div class="thumb">▶</div>`;
    return `<article class="card">${thumbHtml}<div class="card-body"><h3>${title}</h3><p class="muted">${description}</p><a class="btn primary" href="video.html?id=${encodeURIComponent(v.id)}">Watch</a></div></article>`;
  }

  async function loadVideos(){
    const client=getSupabase();
    if(!client) return;
    const containers=document.querySelectorAll('[data-video-list]');
    if(!containers.length) return;

    containers.forEach(c => c.innerHTML='<p class="muted">Loading videos…</p>');
    const {data,error}=await client
      .from('videos')
      .select('*')
      .eq('status','published')
      .order('created_at',{ascending:false})
      .limit(24);

    if(error){
      containers.forEach(c => c.innerHTML=`<p class="muted">Could not load videos. Check your Supabase RLS policy for the videos table.</p>`);
      console.error('Supabase videos error:', error);
      return;
    }
    containers.forEach(c => c.innerHTML = data && data.length ? data.map(videoCard).join('') : '<p class="muted">No published videos yet.</p>');
  }

  async function setupAuth(){
    const client=getSupabase();
    if(!client) return;

    const loginBtn=document.querySelector('[data-login]');
    if(loginBtn){
      loginBtn.addEventListener('click', async ()=>{
        const email=document.querySelector('#email')?.value.trim();
        const password=document.querySelector('#password')?.value;
        const msg=document.querySelector('[data-auth-message]');
        if(!email || !password){ if(msg) msg.textContent='Enter your email and password.'; return; }
        loginBtn.disabled=true; loginBtn.textContent='Logging in…';
        const {error}=await client.auth.signInWithPassword({email,password});
        if(error){ if(msg) msg.textContent=error.message; loginBtn.disabled=false; loginBtn.textContent='Log In'; return; }
        location.href='index.html';
      });
    }

    const signupBtn=document.querySelector('[data-signup]');
    if(signupBtn){
      signupBtn.addEventListener('click', async ()=>{
        const username=document.querySelector('#username')?.value.trim();
        const email=document.querySelector('#email')?.value.trim();
        const password=document.querySelector('#password')?.value;
        const confirm=document.querySelector('#confirm')?.value;
        const msg=document.querySelector('[data-auth-message]');
        if(!username || !email || !password){ if(msg) msg.textContent='Complete all required fields.'; return; }
        if(password!==confirm){ if(msg) msg.textContent='Passwords do not match.'; return; }
        if(password.length<6){ if(msg) msg.textContent='Password must be at least 6 characters.'; return; }
        signupBtn.disabled=true; signupBtn.textContent='Creating…';
        const {data,error}=await client.auth.signUp({email,password,options:{data:{username}}});
        if(error){ if(msg) msg.textContent=error.message; signupBtn.disabled=false; signupBtn.textContent='Create Account'; return; }
        if(msg) msg.textContent=data.session ? 'Account created. Redirecting…' : 'Account created. Check your email to confirm your account.';
        if(data.session) setTimeout(()=>location.href='index.html',500);
        else { signupBtn.disabled=false; signupBtn.textContent='Create Account'; }
      });
    }

    const {data:{session}}=await client.auth.getSession();
    document.querySelectorAll('[data-auth-only]').forEach(el=>{ if(!session) el.style.display='none'; });
    document.querySelectorAll('[data-logout]').forEach(btn=>{
      btn.addEventListener('click', async()=>{ await client.auth.signOut(); location.href='index.html'; });
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{root.classList.toggle('dark');localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light')}));
    document.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('menu-open')));
    document.querySelectorAll('[data-overlay]').forEach(x=>x.addEventListener('click',()=>document.body.classList.remove('menu-open')));
    document.querySelectorAll('[data-lang]').forEach(s=>{s.value=lang;s.addEventListener('change',()=>localStorage.setItem('lang',s.value))});
    const page=location.pathname.split('/').pop()||'index.html';
    document.querySelectorAll('.side-link').forEach(a=>{if(a.getAttribute('href')===page)a.classList.add('active')});
    setupAuth();
    loadVideos();
  });
})();