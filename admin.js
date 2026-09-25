const ADMIN_SETTINGS_DEFAULTS={site_name:'Vexa',site_description:'Responsive video and photo platform',site_copyright:'© 2026 Vexa — Authorized and demo content only.',accent:'#7c3aed',accent2:'#38bdf8',dark_bg:'#08090b',dark_surface:'#111318',light_bg:'#f5f6f8',light_surface:'#ffffff'};
let adminVideos=[]; let adminCategories=new Map();
const q=s=>document.querySelector(s);
const escA=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toLocalInput=iso=>{const d=new Date(iso||Date.now());const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
const fromInput=v=>new Date(v).toISOString();
function isAdmin(session){return !!session?.user && session.user.app_metadata?.role==='admin';}
async function initAdmin(){
 if(!window.supabaseClient){return deny('Supabase is not configured.');}
 const {data:{session}}=await window.supabaseClient.auth.getSession();
 if(!isAdmin(session)){return deny('Administrator access is required. Sign in with the account that has the admin role.');}
 q('#adminGuard').hidden=true;q('#adminApp').hidden=false;q('#adminEmail').textContent=session.user.email||'';
 await loadSettings(); await loadVideos(); bindForms();
}
function deny(msg){q('#adminGuard').innerHTML=`<h2>Admin access</h2><p>${escA(msg)}</p><a class="btn primary" href="login.html">Go to login</a>`;}
async function loadSettings(){
 const {data}=await window.supabaseClient.from('site_settings').select('key,value');const s={...ADMIN_SETTINGS_DEFAULTS};(data||[]).forEach(r=>s[r.key]=r.value);
 q('#siteName').value=s.site_name;q('#siteDescription').value=s.site_description;q('#siteCopyright').value=s.site_copyright;q('#accent').value=s.accent;q('#accent2').value=s.accent2;q('#darkBg').value=s.dark_bg;q('#darkSurface').value=s.dark_surface;q('#lightBg').value=s.light_bg;q('#lightSurface').value=s.light_surface;
}
async function saveSettings(values,msgId){
 const rows=Object.entries(values).map(([key,value])=>({key,value:String(value)}));
 const {error}=await window.supabaseClient.from('site_settings').upsert(rows,{onConflict:'key'});q('#'+msgId).textContent=error?error.message:'Saved.';if(!error){applySettings(values);}
}
function applySettings(s){const root=document.documentElement;if(s.accent)root.style.setProperty('--accent',s.accent);if(s.accent2)root.style.setProperty('--accent2',s.accent2);if(s.dark_bg)root.style.setProperty('--dark-bg',s.dark_bg);if(s.dark_surface)root.style.setProperty('--dark-surface',s.dark_surface);}
function bindForms(){
 q('#siteForm').onsubmit=e=>{e.preventDefault();saveSettings({site_name:q('#siteName').value.trim(),site_description:q('#siteDescription').value.trim(),site_copyright:q('#siteCopyright').value.trim()},'siteMsg');};
 q('#appearanceForm').onsubmit=e=>{e.preventDefault();saveSettings({accent:q('#accent').value,accent2:q('#accent2').value,dark_bg:q('#darkBg').value,dark_surface:q('#darkSurface').value,light_bg:q('#lightBg').value,light_surface:q('#lightSurface').value},'appearanceMsg');};
 q('#videoSearch').oninput=renderVideoRows;q('#refreshVideos').onclick=loadVideos;
}
async function loadVideos(){
 const cat=await window.supabaseClient.from('categories').select('id,name'); adminCategories=new Map((cat.data||[]).map(c=>[String(c.id),c.name]));
 const {data,error}=await window.supabaseClient.from('videos').select('id,title,category_id,created_at,thumbnail_url').order('created_at',{ascending:false}).limit(500);adminVideos=data||[];q('#videoCount').textContent=adminVideos.length;if(error){q('#adminVideoRows').innerHTML=`<tr><td colspan="5">${escA(error.message)}</td></tr>`;return;}renderVideoRows();}
function renderVideoRows(){const term=(q('#videoSearch')?.value||'').toLowerCase();const rows=adminVideos.filter(v=>`${v.title||''} ${adminCategories.get(String(v.category_id))||'Video'}`.toLowerCase().includes(term));q('#adminVideoRows').innerHTML=rows.map(v=>`<tr><td><strong>${escA(v.title||'Untitled')}</strong></td><td>${escA(adminCategories.get(String(v.category_id))||'Video')}</td><td><input class="date-input" type="datetime-local" value="${toLocalInput(v.created_at)}" data-date-id="${escA(v.id)}"></td><td><div class="quick-dates"><button class="btn tiny" data-age="0" data-id="${escA(v.id)}">Now</button><button class="btn tiny" data-age="7" data-id="${escA(v.id)}">7d old</button><button class="btn tiny" data-age="30" data-id="${escA(v.id)}">30d old</button><button class="btn tiny" data-age="365" data-id="${escA(v.id)}">1y old</button></div></td><td><button class="btn primary tiny save-date" data-id="${escA(v.id)}">Save</button></td></tr>`).join('')||'<tr><td colspan="5">No videos found.</td></tr>';
 document.querySelectorAll('[data-age]').forEach(b=>b.onclick=()=>{const input=document.querySelector(`[data-date-id="${CSS.escape(b.dataset.id)}"]`);const d=new Date();d.setDate(d.getDate()-Number(b.dataset.age));input.value=toLocalInput(d.toISOString());});
 document.querySelectorAll('.save-date').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;const input=document.querySelector(`[data-date-id="${CSS.escape(id)}"]`);b.disabled=true;const {error}=await window.supabaseClient.from('videos').update({created_at:fromInput(input.value)}).eq('id',id);b.disabled=false;if(error)alert(error.message);else{const v=adminVideos.find(x=>String(x.id)===String(id));if(v)v.created_at=fromInput(input.value);b.textContent='Saved';setTimeout(()=>b.textContent='Save',900);}});
}
window.addEventListener('DOMContentLoaded',initAdmin);
