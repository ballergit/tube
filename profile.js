const profileClient = window.supabaseClient;
const profileEsc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function profileAge(date){
  if(!date)return '';
  const d=new Date(date), now=new Date();
  let years=now.getUTCFullYear()-d.getUTCFullYear();
  const birthday=new Date(Date.UTC(now.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
  if(birthday>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())))years--;
  if(years>=1)return `Account age: ${years} year${years===1?'':'s'}`;
  const months=Math.max(0,(now.getUTCFullYear()-d.getUTCFullYear())*12+now.getUTCMonth()-d.getUTCMonth());
  if(months>=1)return `Account age: ${months} month${months===1?'':'s'}`;
  return 'Account age: less than a month';
}

async function getProfileTarget(){
  const params=new URLSearchParams(location.search);
  const requested=params.get('id');
  const {data:{user}}=await profileClient.auth.getUser();
  if(!requested){ if(!user){location.href='login.html?returnTo='+encodeURIComponent(location.pathname+location.search);return null;} return {id:user.id,user,own:true}; }
  return {id:requested,user,own:!!user&&user.id===requested};
}

async function profileCounts(id){
  let followers=0,following=0;
  const f=await profileClient.rpc('vexa_follow_counts',{p_creator_id:id});
  if(!f.error)followers=Number(f.data||0);
  const g=await profileClient.rpc('vexa_following_count',{p_user_id:id});
  if(!g.error)following=Number(g.data||0);
  return {followers,following};
}

async function uploadProfileAsset(file,userId,type){
  if(!file)return null;
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${userId}/${type}-${Date.now()}.${ext}`;
  const {error}=await profileClient.storage.from('profile-assets').upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
  if(error)throw error;
  const {data}=profileClient.storage.from('profile-assets').getPublicUrl(path);
  return data.publicUrl;
}

async function renderProfile(){
  const box=document.getElementById('profilePage'); if(!box)return;
  if(!profileClient){box.innerHTML='<div class="form"><h1>Profile</h1><p class="muted">Supabase is not connected.</p></div>';return;}
  const target=await getProfileTarget(); if(!target)return;
  const {id,user,own}=target;
  let profile,error;
  if(own){
    const ensured=await profileClient.rpc('vexa_ensure_profile');
    if(!ensured.error) profile=ensured.data;
    if(!profile){ const result=await profileClient.from('profiles').select('*').eq('id',id).maybeSingle(); profile=result.data; error=result.error; }
  }else{
    const result=await profileClient.from('vexa_public_profiles').select('*').eq('id',id).maybeSingle(); profile=result.data; error=result.error;
  }
  if(error){box.innerHTML=`<div class="form"><h1>Profile</h1><p class="muted">${profileEsc(error.message)}</p></div>`;return;}
  if(!profile){box.innerHTML='<div class="form"><h1>Profile</h1><p class="muted">Profile not found.</p></div>';return;}

  const counts=await profileCounts(id);
  const creator=profile.is_creator===true;
  const name=profile.display_name||profile.username||user?.email?.split('@')[0]||'User';
  const handle=profile.username?`@${profile.username}`:'';
  const avatar=profile.avatar_url||user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'';
  const banner=profile.banner_url||'';
  const bio=profile.bio||'';
  const social=profile.social_link||'';
  const verified=creator&&profile.creator_verified;
  const accountAge=own?profileAge(profile.created_at||user?.created_at):'';

  let subscribed=false;
  if(user&&user.id!==id&&creator){const q=await profileClient.from('creator_followers').select('creator_id').eq('creator_id',id).eq('follower_id',user.id).maybeSingle();subscribed=!!q.data;}

  box.innerHTML=`<section class="reddit-profile">
    <div class="reddit-cover">${banner?`<img src="${profileEsc(banner)}" alt="">`:''}</div>
    <div class="reddit-profile-body">
      <div class="reddit-profile-top">
        <div class="reddit-avatar">${avatar?`<img src="${profileEsc(avatar)}" alt="${profileEsc(name)}">`:`<span>${profileEsc(name.slice(0,1).toUpperCase())}</span>`}</div>
        <div class="reddit-main-info"><div class="reddit-name-line"><h1>${profileEsc(name)}</h1>${verified?'<span class="verified-badge" title="Verified Creator">✓</span>':''}</div>${handle?`<div class="reddit-handle">${profileEsc(handle)}</div>`:''}</div>
        <div class="reddit-actions">${own?'<button class="btn primary" id="editProfileBtn">Edit Profile</button>':creator&&user?`<button class="btn primary" id="subscribeProfileBtn">${subscribed?'Subscribed':'Subscribe'}</button>`:''}</div>
      </div>
      <div class="reddit-stats"><span><strong>${counts.followers.toLocaleString()}</strong> Followers</span><span><strong>${counts.following.toLocaleString()}</strong> Following</span></div>
      ${bio?`<p class="reddit-bio">${profileEsc(bio)}</p>`:''}
      ${social?`<a class="reddit-social" href="${profileEsc(social)}" target="_blank" rel="noopener">${profileEsc(social.replace(/^https?:\/\//,'').replace(/\/$/,''))}</a>`:''}
      ${own&&accountAge?`<div class="reddit-private-age">${profileEsc(accountAge)}</div>`:''}
      <nav class="reddit-tabs">${creator?'<button class="reddit-tab active" data-tab="posts">Posts</button><button class="reddit-tab" data-tab="comments">Comments</button>':''}<button class="reddit-tab ${creator?'':'active'}" data-tab="about">About</button></nav>
      <section id="profileTabContent" class="reddit-tab-content"><p class="muted">Loading...</p></section>
    </div>
  </section>`;

  const content=document.getElementById('profileTabContent');
  const loadAbout=()=>{content.innerHTML=`<div class="profile-about"><h2>About</h2>${bio?`<p>${profileEsc(bio)}</p>`:'<p class="muted">No bio added yet.</p>'}${social?`<p><a class="reddit-social" href="${profileEsc(social)}" target="_blank" rel="noopener">${profileEsc(social)}</a></p>`:''}${own?`<p class="muted">${profileEsc(accountAge)}</p>`:''}</div>`;};
  const loadPosts=async()=>{content.innerHTML='<p class="muted">Loading posts...</p>';const {data}=await profileClient.from('vexa_published_videos').select('*').eq('uploader_id',id).order('created_at',{ascending:false}).limit(60);const rows=data||[];content.innerHTML=`<div class="grid home-grid">${rows.map(v=>createCard(v)).join('')||'<p class="muted">No posts yet.</p>'}</div>`;if(window.setupPreviews)window.setupPreviews();};
  const loadComments=async()=>{content.innerHTML='<p class="muted">Loading comments...</p>';const {data:videos}=await profileClient.from('vexa_published_videos').select('id,title').eq('uploader_id',id).limit(300);const ids=(videos||[]).map(v=>v.id);if(!ids.length){content.innerHTML='<p class="muted">No comments yet.</p>';return;}const {data:comments}=await profileClient.from('video_comments').select('video_id,body,created_at').in('video_id',ids).eq('status','approved').order('created_at',{ascending:false}).limit(100);const titles=Object.fromEntries((videos||[]).map(v=>[v.id,v.title]));content.innerHTML=(comments||[]).map(c=>`<article class="profile-comment"><div class="muted">On ${profileEsc(titles[c.video_id]||'a video')} · ${new Date(c.created_at).toLocaleDateString()}</div><p>${profileEsc(c.body)}</p></article>`).join('')||'<p class="muted">No comments yet.</p>';};

  const activate=async tab=>{document.querySelectorAll('.reddit-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));if(tab==='about')return loadAbout();if(tab==='posts')return loadPosts();if(tab==='comments')return loadComments();};
  document.querySelectorAll('.reddit-tab').forEach(t=>t.onclick=()=>activate(t.dataset.tab));
  await activate(creator?'posts':'about');

  if(own)setupEditProfile(box,{id,profile,user,counts,creator});
  const sub=document.getElementById('subscribeProfileBtn');
  if(sub)sub.onclick=async()=>{const q=subscribed?profileClient.from('creator_followers').delete().eq('creator_id',id).eq('follower_id',user.id):profileClient.from('creator_followers').insert({creator_id:id,follower_id:user.id});const r=await q;if(r.error){alert(r.error.message);return;}subscribed=!subscribed;sub.textContent=subscribed?'Subscribed':'Subscribe';};
}

function setupEditProfile(box,state){
  const btn=document.getElementById('editProfileBtn'); if(!btn)return;
  btn.onclick=()=>{
    const p=state.profile;
    const modal=document.createElement('div');modal.className='profile-edit-overlay';modal.innerHTML=`<div class="profile-edit-modal"><button class="profile-edit-close" type="button" aria-label="Close">×</button><h2>Edit Profile</h2><form id="profileEditForm"><div class="profile-edit-preview"><img id="editAvatarPreview" src="${profileEsc(p.avatar_url||'')}" ${p.avatar_url?'':'hidden'}><span id="editAvatarFallback" ${p.avatar_url?'hidden':''}>${profileEsc((p.display_name||p.username||'U').slice(0,1).toUpperCase())}</span></div><label class="field"><span>Profile picture</span><input id="editAvatar" type="file" accept="image/*"></label><label class="field"><span>Cover/banner</span><input id="editBanner" type="file" accept="image/*"></label><label class="field"><span>Display name</span><input id="editDisplayName" maxlength="80" value="${profileEsc(p.display_name||'')}"></label><label class="field"><span>Username / handle</span><input id="editUsername" maxlength="40" value="${profileEsc(p.username||'')}"></label><label class="field"><span>Bio</span><textarea id="editBio" maxlength="500" rows="4">${profileEsc(p.bio||'')}</textarea></label><label class="field"><span>Social-network link</span><input id="editSocial" type="url" placeholder="https://" value="${profileEsc(p.social_link||'')}"></label><p id="profileEditMsg" class="muted"></p><div class="profile-edit-actions"><button class="btn" type="button" id="cancelProfileEdit">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>`;document.body.appendChild(modal);
    const close=()=>modal.remove();modal.querySelector('.profile-edit-close').onclick=close;modal.querySelector('#cancelProfileEdit').onclick=close;
    modal.querySelector('#profileEditForm').onsubmit=async e=>{e.preventDefault();const msg=modal.querySelector('#profileEditMsg');msg.textContent='Saving…';try{
      const avatarFile=modal.querySelector('#editAvatar').files[0];const bannerFile=modal.querySelector('#editBanner').files[0];let avatarUrl=p.avatar_url||null,bannerUrl=p.banner_url||null;if(avatarFile)avatarUrl=await uploadProfileAsset(avatarFile,state.id,'avatar');if(bannerFile)bannerUrl=await uploadProfileAsset(bannerFile,state.id,'banner');
      const username=modal.querySelector('#editUsername').value.trim().replace(/^@/,'');const displayName=modal.querySelector('#editDisplayName').value.trim();const bio=modal.querySelector('#editBio').value.trim();const social=modal.querySelector('#editSocial').value.trim();if(social&&!/^https?:\/\//i.test(social))throw new Error('Social link must start with http:// or https://');
      const {error}=await profileClient.from('profiles').update({username:username||null,display_name:displayName||null,bio:bio||null,social_link:social||null,avatar_url:avatarUrl,banner_url:bannerUrl}).eq('id',state.id);if(error)throw error;
      await profileClient.auth.updateUser({data:{username:username||null,display_name:displayName||null,avatar_url:avatarUrl}});
      close();await renderProfile();
    }catch(err){msg.textContent=err.message||'Could not save profile.';}
    };
  };
}

document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('profilePage'))renderProfile();});
