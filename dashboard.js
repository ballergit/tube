const client=window.supabaseClient;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null, videos=[], photos=[];

document.addEventListener('DOMContentLoaded',async()=>{
  setupTheme();
  const box=document.getElementById('dashboardPage');
  if(!client){box.innerHTML='<div class="form"><h1>My Dashboard</h1><p class="muted">Supabase is not connected.</p></div>';return;}
  const {data}=await client.auth.getUser(); user=data.user;
  if(!user){location.href='login.html';return;}
  const creatorCheck=await client.rpc('is_vexa_creator');
  if(creatorCheck.error||creatorCheck.data!==true){location.replace('creator-apply.html');return;}
  await load();
});
function setupTheme(){const saved=localStorage.getItem('vexa-theme');document.documentElement.classList.toggle('light',saved==='light');const b=document.getElementById('themeBtn');if(b)b.onclick=()=>{const light=!document.documentElement.classList.contains('light');document.documentElement.classList.toggle('light',light);localStorage.setItem('vexa-theme',light?'light':'dark');};}
async function load(){
  const [vr,pr,profile]=await Promise.all([
    client.from('videos').select('*').eq('uploader_id',user.id).order('created_at',{ascending:false}),
    client.from('photos').select('*').eq('uploader_id',user.id).order('created_at',{ascending:false}),
    client.from('profiles').select('username,display_name').eq('id',user.id).maybeSingle()
  ]);
  videos=vr.data||[]; photos=pr.data||[];
  const statsResult=await client.rpc('vexa_creator_stats');
  render(profile.data, statsResult.error?{}:(statsResult.data||{}));
}
function statusLabel(s){return s||'draft';}
function render(profile,stats={}){
  const name=profile?.display_name||profile?.username||user.email?.split('@')[0]||'User';
  const all=[...videos.map(v=>({...v,_type:'video'})),...photos.map(p=>({...p,_type:'photo'}))];
  document.getElementById('dashboardPage').innerHTML=`<div class="section-title"><div><h1>Creator Dashboard</h1><div class="muted">Manage your creator content, approvals and publishing status.</div></div><a class="btn primary" href="upload.html">Upload content</a></div>
  <div class="stat-grid"><div class="stat-card"><div class="num">${videos.length}</div><div class="lbl">Videos</div></div><div class="stat-card"><div class="num">${photos.length}</div><div class="lbl">Photos</div></div><div class="stat-card"><div class="num">${all.filter(x=>x.status==='pending').length}</div><div class="lbl">Pending</div></div><div class="stat-card"><div class="num">${all.filter(x=>x.status==='published').length}</div><div class="lbl">Published</div></div><div class="stat-card"><div class="num">${Number(stats.views||0).toLocaleString()}</div><div class="lbl">Content Views</div></div><div class="stat-card"><div class="num">${Number(stats.followers||0).toLocaleString()}</div><div class="lbl">Followers</div></div><div class="stat-card"><div class="num">${Number(stats.profile_views||0).toLocaleString()}</div><div class="lbl">Profile Views</div></div><div class="stat-card"><div class="num">${Number(stats.saves||0).toLocaleString()}</div><div class="lbl">Saves</div></div></div>
  <div class="dashboard-toolbar"><button class="btn primary" data-filter="all">All</button><button class="btn" data-filter="draft">Draft</button><button class="btn" data-filter="pending">Pending Approval</button><button class="btn" data-filter="published">Published</button><button class="btn" data-filter="rejected">Rejected</button><button class="btn" data-filter="archived">Archived</button></div>
  <div id="myContent" class="dashboard-list"></div>`;
  document.querySelectorAll('.dashboard-toolbar [data-filter]').forEach(b=>b.onclick=()=>renderContent(b.dataset.filter));
  renderContent('all');
}
function renderContent(filter){
  const rows=[...videos.map(v=>({...v,_type:'video'})),...photos.map(p=>({...p,_type:'photo'}))].filter(x=>filter==='all'||x.status===filter);
  const wrap=document.getElementById('myContent');
  if(!rows.length){wrap.innerHTML='<p class="muted">No content in this status.</p>';return;}
  wrap.innerHTML=rows.map(x=>`<article class="dashboard-item"><div class="dashboard-thumb"><img src="${esc(x.thumbnail_url||x.image_url||'https://placehold.co/640x360/111/fff?text=Vexa')}" alt=""></div><div class="dashboard-item-body"><div class="dashboard-item-top"><div><h3>${esc(x.title||'Untitled')}</h3><div class="muted">${esc(x._type)} · ${new Date(x.created_at||x.submitted_at||Date.now()).toLocaleDateString()}</div></div><span class="badge ${esc(x.status||'draft')}">${esc(statusLabel(x.status))}</span></div><p class="muted dashboard-description">${esc(x.description||'')}</p><div class="row-actions"><button class="btn" onclick="editItem('${x._type}',${x.id})">Edit</button><button class="btn danger" onclick="deleteItem('${x._type}',${x.id})">Delete</button>${x.status==='published'?`<a class="btn" href="${x._type==='video'?`video.html?id=${x.id}`:'photos.html'}">View</a>`:''}</div></div></article>`).join('');
}
window.editItem=async(type,id)=>{
 const table=type==='video'?'videos':'photos'; const item=(type==='video'?videos:photos).find(x=>String(x.id)===String(id)); if(!item)return;
 const existing=document.getElementById('editModal'); if(existing)existing.remove();
 const mediaLabel=type==='video'?'Replace video file (optional)':'Replace photo (optional)';
 const currentMedia=item.image_url||item.video_url||'';
 const modal=document.createElement('div'); modal.id='editModal'; modal.className='edit-modal';
 modal.innerHTML=`<div class="edit-dialog"><div class="section-title"><h2>Edit ${esc(type)}</h2><button class="btn" id="closeEdit">Close</button></div><div class="field"><label>Title</label><input id="editTitle" value="${esc(item.title||'')}"></div><div class="field"><label>Description</label><textarea id="editDescription" rows="5">${esc(item.description||'')}</textarea></div><div class="field"><label>Category</label><input id="editCategory" value="${esc(item.category||'General')}"></div><div class="field"><label>Tags (comma separated)</label><input id="editTags" value="${esc(Array.isArray(item.tags)?item.tags.join(', '):(item.tags||''))}"></div><div class="field"><label>${mediaLabel}</label><input id="editMedia" type="file" accept="${type==='video'?'video/*':'image/*'}"></div><div class="field"><label>${type==='video'?'Replace thumbnail (optional)':'Replace thumbnail (optional)'}</label><input id="editThumb" type="file" accept="image/*"></div><div class="muted" style="font-size:12px;word-break:break-all">Current media: ${esc(currentMedia)}</div><div class="row-actions" style="margin-top:14px"><button class="btn primary" id="saveEdit">Save changes</button></div><p id="editMsg" class="muted"></p></div>`;
 document.body.appendChild(modal);
 document.getElementById('closeEdit').onclick=()=>modal.remove();
 document.getElementById('saveEdit').onclick=async()=>{
   const msg=document.getElementById('editMsg'); msg.textContent='Saving...';
   const patch={title:document.getElementById('editTitle').value.trim(),description:document.getElementById('editDescription').value.trim(),category:document.getElementById('editCategory').value.trim()||'General',tags:document.getElementById('editTags').value.split(',').map(x=>x.trim()).filter(Boolean)};
   const media=document.getElementById('editMedia').files[0],thumb=document.getElementById('editThumb').files[0];
   if(media){const path=`${user.id}/${Date.now()}-${media.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const bucket=type==='video'?'videos':'photos';const up=await client.storage.from(bucket).upload(path,media,{upsert:false,contentType:media.type});if(up.error){msg.textContent=up.error.message;return;}const url=client.storage.from(bucket).getPublicUrl(path).data.publicUrl;patch[type==='video'?'video_url':'image_url']=url;}
   if(thumb){const path=`${user.id}/${Date.now()}-thumb-${thumb.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await client.storage.from('thumbnails').upload(path,thumb,{upsert:false,contentType:thumb.type});if(up.error){msg.textContent=up.error.message;return;}patch.thumbnail_url=client.storage.from('thumbnails').getPublicUrl(path).data.publicUrl;}
   const {error}=await client.from(table).update(patch).eq('id',id).eq('uploader_id',user.id); if(error){msg.textContent=error.message;return;}
   modal.remove(); await load();
 };
};
window.deleteItem=async(type,id)=>{
 if(!confirm('Delete this upload? This removes it from the database and public view.'))return;
 const table=type==='video'?'videos':'photos'; const {error}=await client.from(table).delete().eq('id',id).eq('uploader_id',user.id);
 if(error){alert(error.message);return;} await load();
};
