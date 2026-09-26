// Vexa Admin Portal: full CMS with uploads, content editing, layout management, date control.

const esc=s=>s?String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])):s;
let currentUser=null, allVideos=[], allPhotos=[], allComments=[], allUsers=[], allCategories=[], allTags=[], allSections=[], editingContentId=null, editingContentType=null;

document.addEventListener("DOMContentLoaded", async ()=>{
  setupTheme(); applySiteSettings();
  const auth=await window.supabaseClient.auth.getSession();
  if(!auth.data?.session) return gateMsg("Not signed in.");
  currentUser=auth.data.session.user;
  const isAdmin=await checkAdmin();
  if(!isAdmin) return gateMsg("Admin access required.");
  document.getElementById("gate").hidden=true;
  document.getElementById("adminApp").hidden=false;
  setupTabs(); setupActions(); setupModals(); populateCategorySelects(); await loadEverything();
});

function gateMsg(msg){
  document.getElementById("gate").innerHTML=`<p style="color:var(--error)">${esc(msg)}</p>`;
}

async function checkAdmin(){
  try{
    const {data,error}=await window.supabaseClient.rpc("is_vexa_admin");
    return data===true;
  }catch(e){return false;}
}

function toggleMobileMenu(){
  document.getElementById("adminSidebar").classList.toggle("mobile-open");
}

function setupTabs(){
  document.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      const tab=btn.dataset.tab;
      document.getElementById(`panel-${tab}`)?.classList.add("active");
      if(window.innerWidth<900) document.getElementById("adminSidebar").classList.remove("mobile-open");
    };
  });
}

function setupModals(){
  document.querySelectorAll(".modal").forEach(m=>{
    m.onclick=(e)=>{if(e.target===m)closeModal(m.id);};
  });
}

window.openModal=(id)=>{document.getElementById(id).hidden=false;};
window.closeModal=(id)=>{document.getElementById(id).hidden=true;};

async function populateCategorySelects(){
  try{
    const {data}=await window.supabaseClient.from("categories").select("*").order("name");
    const cats=data||[];
    const opts=cats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    document.querySelectorAll("[id*='Category']").forEach(sel=>{sel.innerHTML="<option value=''>General</option>"+opts;});
  }catch(e){}
}

function setupActions(){
  document.querySelectorAll("[data-goto]").forEach(btn=>{
    btn.onclick=()=>{
      const tab=btn.dataset.goto;
      document.querySelector(`[data-tab="${tab}"]`)?.click();
    };
  });

  document.getElementById("refreshAll").onclick=loadEverything;
  document.getElementById("videoSearch").oninput=filterVideos;
  document.getElementById("videoStatusFilter").onchange=filterVideos;
  document.getElementById("uploadVideoBtn").onclick=()=>openModal("uploadVideoModal");
  document.getElementById("submitUploadVideoBtn").onclick=uploadVideo;

  document.getElementById("photoSearch").oninput=filterPhotos;
  document.getElementById("photoStatusFilter").onchange=filterPhotos;
  document.getElementById("uploadPhotoBtn").onclick=()=>openModal("uploadPhotoModal");
  document.getElementById("submitUploadPhotoBtn").onclick=uploadPhoto;

  document.getElementById("addCategoryBtn").onclick=addCategory;
  document.getElementById("newCategoryName").onkeydown=(e)=>{if(e.key==="Enter")addCategory();};
  document.getElementById("addTagBtn").onclick=addTag;
  document.getElementById("newTagName").onkeydown=(e)=>{if(e.key==="Enter")addTag();};
  document.getElementById("featuredPicker").oninput=searchFeaturedPicker;
  document.getElementById("userSearch").oninput=filterUsers;
  document.getElementById("commentStatusFilter").onchange=filterComments;
  document.getElementById("saveSiteBtn").onclick=saveSiteInfo;
  document.getElementById("saveAppearanceBtn").onclick=saveAppearance;
  document.getElementById("addNavItemBtn").onclick=addNavItem;
  document.getElementById("saveNavBtn").onclick=saveNavigation;
  document.getElementById("saveFooterBtn").onclick=saveFooter;
  document.getElementById("promoteBtn").onclick=promoteToAdmin;
  document.getElementById("saveLayoutBtn").onclick=saveLayout;
  setupColorSwatches();
}

async function loadEverything(){
  await Promise.all([loadDashboard(),loadVideos(),loadPhotos(),loadCategories(),loadTags(),loadUsers(),loadComments(),loadSiteSettings(),loadNavigation(),loadLayout()]);
  loadPendingContent(); loadFeaturedTrending();
}

async function loadDashboard(){
  try{
    const {data}=await window.supabaseClient.rpc("vexa_admin_stats");
    const html=Object.entries(data).map(([k,v])=>`<div class="stat-card"><div class="num">${v}</div><div class="lbl">${esc(k.replace(/_/g," "))}</div></div>`).join("");
    document.getElementById("statGrid").innerHTML=html;
  }catch(e){console.error(e);}
}

async function loadLayout(){
  try{
    const {data}=await window.supabaseClient.from("page_sections").select("*").eq("page","home").order("display_order");
    allSections=data||[];
    renderLayoutEditor();
  }catch(e){console.error(e);}
}

function renderLayoutEditor(){
  const html=allSections.map((s,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface);border-radius:6px;margin-bottom:6px"><input type="checkbox" ${s.visible?"checked":""} onchange="toggleSectionVisibility(${i},this.checked)" title="Visible"><span style="flex:1"><strong>${esc(s.title||s.section_type)}</strong><br><span class="muted" style="font-size:11px">${esc(s.section_type)}</span></span><button onclick="moveSectionUp(${i})" ${i===0?"disabled":""}>↑</button><button onclick="moveSectionDown(${i})" ${i===allSections.length-1?"disabled":""}>↓</button></div>`).join("");
  document.getElementById("layoutSections").innerHTML=html||"<p class=muted>No sections found.</p>";
}

window.toggleSectionVisibility=(idx,visible)=>{if(allSections[idx])allSections[idx].visible=visible;};
window.moveSectionUp=(idx)=>{if(idx>0)[allSections[idx],allSections[idx-1]]=[allSections[idx-1],allSections[idx]];renderLayoutEditor();};
window.moveSectionDown=(idx)=>{if(idx<allSections.length-1)[allSections[idx],allSections[idx+1]]=[allSections[idx+1],allSections[idx]];renderLayoutEditor();};

async function saveLayout(){
  try{
    for(let i=0;i<allSections.length;i++) await window.supabaseClient.from("page_sections").update({visible:allSections[i].visible,display_order:i}).eq("id",allSections[i].id);
    setMsg("layoutMsg","Layout saved!");
    setTimeout(()=>setMsg("layoutMsg",""),3000);
  }catch(e){setMsg("layoutMsg","Error: "+e.message);}
}

async function loadVideos(){
  try{
    const {data}=await window.supabaseClient.from("videos").select("*").order("created_at",{ascending:false});
    allVideos=data||[];
    filterVideos();
  }catch(e){console.error(e);}
}

function filterVideos(){
  const q=(document.getElementById("videoSearch").value||"").toLowerCase();
  const status=document.getElementById("videoStatusFilter").value;
  let rows=allVideos.filter(v=>(v.title||"").toLowerCase().includes(q));
  if(status)rows=rows.filter(v=>v.status===status);
  const html=rows.length?`<table class="admin-table"><thead><tr><th>Thumb</th><th>Title</th><th>Status</th><th>Views</th><th>Date</th><th>Actions</th></tr></thead><tbody>${rows.map(v=>`<tr><td><img src="${esc(v.thumbnail_url||'')}" alt=""></td><td>${esc(v.title||"")}</td><td><span class="badge ${v.status||'published'}">${esc(v.status||"published")}</span></td><td>${v.views||0}</td><td>${new Date(v.created_at).toLocaleDateString()}</td><td><div class="row-actions"><button class="primary" onclick="openEditVideoModal(${v.id})">Edit</button><button onclick="previewVideo(${v.id})">Preview</button><button class="danger" onclick="deleteVideo(${v.id})">Delete</button></div></td></tr>`).join("")}</tbody></table>`:`<p class="muted">No videos found.</p>`;
  document.getElementById("videoTableWrap").innerHTML=html;
}

async function uploadVideo(){
  const title=document.getElementById("uploadVideoTitle").value.trim();
  const desc=document.getElementById("uploadVideoDesc").value.trim();
  const file=document.getElementById("uploadVideoFile").files[0];
  const thumb=document.getElementById("uploadVideoThumb").value.trim();
  const cat=document.getElementById("uploadVideoCategory").value||"General";
  const tags=(document.getElementById("uploadVideoTags").value||"").split(",").map(t=>t.trim()).filter(t=>t);
  const publish=document.getElementById("uploadVideoPublish").checked;
  if(!title||!file)return setMsg("uploadVideoMsg","Please fill in title and select a file.");
  try{
    setMsg("uploadVideoMsg","Uploading...");
    const path=`videos/${Date.now()}_${file.name}`;
    const {data,error}=await window.supabaseClient.storage.from("vexa-bucket").upload(path,file);
    if(error)throw error;
    const videoUrl=`${window.supabaseClient.supabaseUrl}/storage/v1/object/public/vexa-bucket/${path}`;
    await window.supabaseClient.from("videos").insert([{title,description:desc,video_url:videoUrl,thumbnail_url:thumb,category:cat,tags,uploader_id:currentUser.id,uploader_name:currentUser.email,status:publish?"published":"pending",featured:false,trending:false,views:0}]);
    setMsg("uploadVideoMsg","Video uploaded!");
    setTimeout(()=>{closeModal("uploadVideoModal");loadVideos();},1500);
  }catch(e){setMsg("uploadVideoMsg","Error: "+e.message);}
}

window.openEditVideoModal=async(id)=>{
  const v=allVideos.find(x=>x.id===id);
  if(!v)return;
  document.getElementById("editVideoTitle").value=v.title||"";
  document.getElementById("editVideoDesc").value=v.description||"";
  document.getElementById("editVideoThumb").value=v.thumbnail_url||"";
  document.getElementById("editVideoCategory").value=v.category||"General";
  document.getElementById("editVideoTags").value=(v.tags||[]).join(", ");
  document.getElementById("editVideoUploader").value=v.uploader_name||"";
  document.getElementById("editVideoDate").value=new Date(v.created_at).toISOString().slice(0,16);
  document.getElementById("editVideoStatus").value=v.status||"published";
  document.getElementById("editVideoFeatured").checked=v.featured||false;
  document.getElementById("editVideoTrending").checked=v.trending||false;
  document.getElementById("submitEditVideoBtn").onclick=()=>saveEditVideo(id);
  openModal("editVideoModal");
};

async function saveEditVideo(id){
  try{
    const tags=(document.getElementById("editVideoTags").value||"").split(",").map(t=>t.trim()).filter(t=>t);
    await window.supabaseClient.from("videos").update({title:document.getElementById("editVideoTitle").value,description:document.getElementById("editVideoDesc").value,thumbnail_url:document.getElementById("editVideoThumb").value,category:document.getElementById("editVideoCategory").value,tags:tags,uploader_name:document.getElementById("editVideoUploader").value,created_at:new Date(document.getElementById("editVideoDate").value).toISOString(),status:document.getElementById("editVideoStatus").value,featured:document.getElementById("editVideoFeatured").checked,trending:document.getElementById("editVideoTrending").checked}).eq("id",id);
    setMsg("editVideoMsg","Saved!");
    setTimeout(()=>{closeModal("editVideoModal");loadVideos();},1500);
  }catch(e){setMsg("editVideoMsg","Error: "+e.message);}
}

window.previewVideo=(id)=>{window.open("video.html?id="+id,"_blank");};
window.deleteVideo=(id)=>{if(!confirm("Delete this video?"))return;window.supabaseClient.from("videos").delete().eq("id",id).then(()=>loadVideos());};

async function loadPhotos(){
  try{
    const {data}=await window.supabaseClient.from("photos").select("*").order("created_at",{ascending:false});
    allPhotos=data||[];
    filterPhotos();
    loadPendingContent();
  }catch(e){console.error(e);}
}

function filterPhotos(){
  const q=(document.getElementById("photoSearch").value||"").toLowerCase();
  const status=document.getElementById("photoStatusFilter").value;
  let rows=allPhotos.filter(p=>(p.title||"").toLowerCase().includes(q));
  if(status)rows=rows.filter(p=>p.status===status);
  const html=rows.length?`<table class="admin-table"><thead><tr><th>Thumb</th><th>Title</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${rows.map(p=>`<tr><td><img src="${esc(p.image_url)}" alt="" style="height:36px;object-fit:cover"></td><td>${esc(p.title||"Untitled")}</td><td><span class="badge ${p.status}">${esc(p.status)}</span></td><td>${new Date(p.created_at).toLocaleDateString()}</td><td><div class="row-actions"><button class="primary" onclick="openEditPhotoModal(${p.id})">Edit</button><button class="danger" onclick="deletePhoto(${p.id})">Delete</button></div></td></tr>`).join("")}</tbody></table>`:`<p class="muted">No photos found.</p>`;
  document.getElementById("photoTableWrap").innerHTML=html;
}

async function uploadPhoto(){
  const title=document.getElementById("uploadPhotoTitle").value.trim();
  const desc=document.getElementById("uploadPhotoDesc").value.trim();
  const file=document.getElementById("uploadPhotoFile").files[0];
  const cat=document.getElementById("uploadPhotoCategory").value||"General";
  const tags=(document.getElementById("uploadPhotoTags").value||"").split(",").map(t=>t.trim()).filter(t=>t);
  const publish=document.getElementById("uploadPhotoPublish").checked;
  if(!title||!file)return setMsg("uploadPhotoMsg","Please fill in title and select a file.");
  try{
    setMsg("uploadPhotoMsg","Uploading...");
    const path=`photos/${Date.now()}_${file.name}`;
    const {data,error}=await window.supabaseClient.storage.from("vexa-bucket").upload(path,file);
    if(error)throw error;
    const imgUrl=`${window.supabaseClient.supabaseUrl}/storage/v1/object/public/vexa-bucket/${path}`;
    await window.supabaseClient.from("photos").insert([{title,description:desc,image_url:imgUrl,thumbnail_url:imgUrl,category:cat,tags,uploader_id:currentUser.id,uploader_name:currentUser.email,status:publish?"published":"pending",featured:false}]);
    setMsg("uploadPhotoMsg","Photo uploaded!");
    setTimeout(()=>{closeModal("uploadPhotoModal");loadPhotos();},1500);
  }catch(e){setMsg("uploadPhotoMsg","Error: "+e.message);}
}

window.openEditPhotoModal=async(id)=>{
  const p=allPhotos.find(x=>x.id===id);
  if(!p)return;
  document.getElementById("editPhotoTitle").value=p.title||"";
  document.getElementById("editPhotoDesc").value=p.description||"";
  document.getElementById("editPhotoCategory").value=p.category||"General";
  document.getElementById("editPhotoTags").value=(p.tags||[]).join(", ");
  document.getElementById("editPhotoUploader").value=p.uploader_name||"";
  document.getElementById("editPhotoDate").value=new Date(p.created_at).toISOString().slice(0,16);
  document.getElementById("editPhotoStatus").value=p.status||"published";
  document.getElementById("editPhotoFeatured").checked=p.featured||false;
  document.getElementById("submitEditPhotoBtn").onclick=()=>saveEditPhoto(id);
  openModal("editPhotoModal");
};

async function saveEditPhoto(id){
  try{
    const tags=(document.getElementById("editPhotoTags").value||"").split(",").map(t=>t.trim()).filter(t=>t);
    await window.supabaseClient.from("photos").update({title:document.getElementById("editPhotoTitle").value,description:document.getElementById("editPhotoDesc").value,category:document.getElementById("editPhotoCategory").value,tags:tags,uploader_name:document.getElementById("editPhotoUploader").value,created_at:new Date(document.getElementById("editPhotoDate").value).toISOString(),status:document.getElementById("editPhotoStatus").value,featured:document.getElementById("editPhotoFeatured").checked}).eq("id",id);
    setMsg("editPhotoMsg","Saved!");
    setTimeout(()=>{closeModal("editPhotoModal");loadPhotos();},1500);
  }catch(e){setMsg("editPhotoMsg","Error: "+e.message);}
}

window.deletePhoto=(id)=>{if(!confirm("Delete this photo?"))return;window.supabaseClient.from("photos").delete().eq("id",id).then(()=>loadPhotos());};

async function loadPendingContent(){
  const pendingVids=allVideos.filter(v=>v.status==="pending");
  const pendingPhotos=allPhotos.filter(p=>p.status==="pending");
  const vidHTML=pendingVids.length?pendingVids.map(v=>`<div class="card"><img src="${esc(v.thumbnail_url||'')}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px"><h3 style="margin:0 0 6px;font-size:14px">${esc(v.title||"")}</h3><p style="margin:0 0 10px;font-size:12px;color:var(--muted)">${esc(v.uploader_name||"")}</p><div class="row-actions"><button class="primary" onclick="moderateVideo(${v.id},'published')">Approve</button><button class="danger" onclick="moderateVideo(${v.id},'rejected')">Reject</button></div></div>`).join(""):`<p class="muted">No pending videos.</p>`;
  const photoHTML=pendingPhotos.length?pendingPhotos.map(p=>`<div class="card"><img src="${esc(p.image_url)}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px"><h3 style="margin:0 0 6px;font-size:14px">${esc(p.title||"Untitled")}</h3><p style="margin:0 0 10px;font-size:12px;color:var(--muted)">${esc(p.uploader_name||"")}</p><div class="row-actions"><button class="primary" onclick="moderatePhoto(${p.id},'published')">Approve</button><button class="danger" onclick="moderatePhoto(${p.id},'rejected')">Reject</button></div></div>`).join(""):`<p class="muted">No pending photos.</p>`;
  document.getElementById("pendingVideos").innerHTML=vidHTML;
  document.getElementById("pendingPhotos").innerHTML=photoHTML;
}

window.moderateVideo=async(id,status)=>{try{await window.supabaseClient.rpc("vexa_moderate_video",[id,status]);await loadVideos();loadPendingContent();}catch(e){alert("Error: "+e.message);}};
window.moderatePhoto=async(id,status)=>{try{await window.supabaseClient.rpc("vexa_moderate_photo",[id,status]);await loadPhotos();loadPendingContent();}catch(e){alert("Error: "+e.message);}};

async function loadCategories(){
  try{
    const {data}=await window.supabaseClient.from("categories").select("*").order("name");
    allCategories=data||[];
    renderCategories();
  }catch(e){console.error(e);}
}

function renderCategories(){
  const html=allCategories.map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface-2);border-radius:6px;margin-bottom:6px"><input value="${esc(c.name)}" style="flex:1;border:0;background:transparent;color:var(--text);" disabled><button onclick="renameCategory('${esc(c.name)}')">Rename</button><button class="danger" onclick="deleteCategory('${esc(c.name)}')">Delete</button></div>`).join("");
  document.getElementById("categoryList").innerHTML=html;
}

async function addCategory(){
  const name=document.getElementById("newCategoryName").value.trim();
  if(!name)return alert("Enter a name.");
  try{
    await window.supabaseClient.from("categories").insert([{name,slug:name.toLowerCase().replace(/\s+/g,"-")}]);
    document.getElementById("newCategoryName").value="";
    await loadCategories();
    await populateCategorySelects();
  }catch(e){alert("Error: "+e.message);}
}

window.renameCategory=async(old)=>{const n=prompt("New name for '"+old+"':");if(!n)return;try{await window.supabaseClient.rpc("vexa_rename_category",[old,n]);await loadCategories();await populateCategorySelects();}catch(e){alert("Error: "+e.message);}};
window.deleteCategory=async(name)=>{if(!confirm("Delete '"+name+"' (content reassigned to General)?"))return;try{await window.supabaseClient.rpc("vexa_delete_category",[name]);await loadCategories();}catch(e){alert("Error: "+e.message);}};

async function loadTags(){
  try{
    const {data}=await window.supabaseClient.from("tags").select("*").order("name");
    allTags=data||[];
    renderTags();
  }catch(e){console.error(e);}
}

function renderTags(){
  const html=allTags.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface-2);border-radius:6px;margin-bottom:6px"><input value="${esc(t.name)}" style="flex:1;border:0;background:transparent;color:var(--text);" disabled><button onclick="renameTag('${esc(t.name)}')">Rename</button><button class="danger" onclick="deleteTag('${esc(t.name)}')">Delete</button></div>`).join("");
  document.getElementById("tagList").innerHTML=html;
}

async function addTag(){
  const name=document.getElementById("newTagName").value.trim();
  if(!name)return alert("Enter a name.");
  try{
    await window.supabaseClient.from("tags").insert([{name}]);
    document.getElementById("newTagName").value="";
    await loadTags();
  }catch(e){alert("Error: "+e.message);}
}

window.renameTag=async(old)=>{const n=prompt("New name for '"+old+"':");if(!n)return;try{await window.supabaseClient.rpc("vexa_rename_tag",[old,n]);await loadTags();}catch(e){alert("Error: "+e.message);}};
window.deleteTag=async(name)=>{if(!confirm("Delete '"+name+"' (tag removed from all content)?"))return;try{await window.supabaseClient.rpc("vexa_delete_tag",[name]);await loadTags();}catch(e){alert("Error: "+e.message);}};

async function loadFeaturedTrending(){
  const featured=allVideos.filter(v=>v.featured);
  const trending=allVideos.filter(v=>v.trending);
  const fHTML=featured.length?featured.map(v=>`<div class="card"><img src="${esc(v.thumbnail_url||'')}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px"><h3 style="margin:0 0 6px;font-size:14px">${esc(v.title||"")}</h3><button class="danger" onclick="setFeatured(${v.id},false)" style="width:100%">Remove</button></div>`).join(""):`<p class="muted">No featured videos.</p>`;
  const tHTML=trending.length?trending.map(v=>`<div class="card"><img src="${esc(v.thumbnail_url||'')}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px"><h3 style="margin:0 0 6px;font-size:14px">${esc(v.title||"")}</h3><button class="danger" onclick="setTrending(${v.id},false)" style="width:100%">Remove</button></div>`).join(""):`<p class="muted">No trending videos.</p>`;
  document.getElementById("featuredList").innerHTML=fHTML;
  document.getElementById("trendingList").innerHTML=tHTML;
}

async function searchFeaturedPicker(){
  const q=(document.getElementById("featuredPicker").value||"").toLowerCase();
  if(q.length<2){document.getElementById("featuredPickerResults").innerHTML="";return;}
  const results=allVideos.filter(v=>v.status==="published"&&(v.title||"").toLowerCase().includes(q)).slice(0,10);
  const html=results.map(v=>`<div style="padding:8px;background:var(--surface);margin-bottom:6px;border-radius:6px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><img src="${esc(v.thumbnail_url||'')}" alt="" style="width:60px;height:36px;object-fit:cover;border-radius:3px"><span>${esc(v.title||"")}</span></div><button onclick="setFeatured(${v.id},true)" ${v.featured?"disabled":""}>${v.featured?"Already featured":"Add to featured"}</button> <button onclick="setTrending(${v.id},true)" ${v.trending?"disabled":""}>${v.trending?"Already trending":"Add to trending"}</button></div>`).join("");
  document.getElementById("featuredPickerResults").innerHTML=html;
}

window.setFeatured=async(id,val)=>{try{await window.supabaseClient.from("videos").update({featured:val}).eq("id",id);await loadVideos();await loadFeaturedTrending();await searchFeaturedPicker();}catch(e){alert("Error: "+e.message);}};
window.setTrending=async(id,val)=>{try{await window.supabaseClient.from("videos").update({trending:val}).eq("id",id);await loadVideos();await loadFeaturedTrending();await searchFeaturedPicker();}catch(e){alert("Error: "+e.message);}};

async function loadUsers(){
  try{
    const {data}=await window.supabaseClient.from("profiles").select("*").order("created_at",{ascending:false});
    allUsers=data||[];
    filterUsers();
  }catch(e){console.error(e);}
}

function filterUsers(){
  const q=(document.getElementById("userSearch").value||"").toLowerCase();
  let rows=allUsers.filter(u=>(u.display_name||u.username||"").toLowerCase().includes(q));
  const html=rows.length?`<table class="admin-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${esc(u.display_name||"")}</td><td>${esc(u.username||"")}</td><td><span class="badge${u.role==="admin"?" admin":""}">${esc(u.role)}</span></td><td>${new Date(u.created_at).toLocaleDateString()}</td><td><button onclick="changeRole('${esc(u.id)}','${u.role==="admin"?"user":"admin"}')">${u.role==="admin"?"Demote":"Promote"}</button></td></tr>`).join("")}</tbody></table>`:`<p class="muted">No users found.</p>`;
  document.getElementById("userTableWrap").innerHTML=html;
}

window.changeRole=async(id,newRole)=>{if(!confirm("Change role to "+newRole+"?"))return;try{await window.supabaseClient.from("profiles").update({role:newRole}).eq("id",id);await loadUsers();}catch(e){alert("Error: "+e.message);}};

async function loadComments(){
  try{
    const {data}=await window.supabaseClient.from("video_comments").select("*").order("created_at",{ascending:false});
    allComments=data||[];
    filterComments();
  }catch(e){console.error(e);}
}

function filterComments(){
  const status=document.getElementById("commentStatusFilter").value;
  let rows=allComments;
  if(status)rows=rows.filter(c=>c.status===status);
  const html=rows.length?`<table class="admin-table"><thead><tr><th style="min-width:250px">Body</th><th>By</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(c=>`<tr><td style="white-space:pre-wrap;max-width:250px">${esc(c.body)}</td><td>${esc(c.guest_name||c.user_id||"")}</td><td><span class="badge ${c.status}">${esc(c.status)}</span></td><td><button onclick="moderateComment(${c.id},'approved')">Approve</button><button class="danger" onclick="moderateComment(${c.id},'rejected')">Reject</button></td></tr>`).join("")}</tbody></table>`:`<p class="muted">No comments to show.</p>`;
  document.getElementById("commentTableWrap").innerHTML=html;
}

window.moderateComment=async(id,status)=>{try{await window.supabaseClient.from("video_comments").update({status,approved_at:status==="approved"?new Date().toISOString():null,approved_by:status==="approved"?currentUser.id:null}).eq("id",id);await loadComments();}catch(e){alert("Error: "+e.message);}};

async function loadSiteSettings(){
  try{
    const {data}=await window.supabaseClient.from("site_settings").select("*").eq("id",1).maybeSingle();
    if(!data)return;
    document.getElementById("setSiteName").value=data.site_name||"";
    document.getElementById("setDescription").value=data.description||"";
    document.getElementById("setLogoUrl").value=data.logo_url||"";
    document.getElementById("setFaviconUrl").value=data.favicon_url||"";
    document.getElementById("setContactEmail").value=data.contact_email||"";
    const social=data.social||{};
    document.getElementById("setSocialTwitter").value=social.Twitter||"";
    document.getElementById("setSocialInstagram").value=social.Instagram||"";
    document.getElementById("setSocialYoutube").value=social.YouTube||"";
    document.getElementById("setSocialTiktok").value=social.TikTok||"";
    document.getElementById("setAccentColor").value=data.accent_color||"#6d5efc";
    document.getElementById("setFooterText").value=data.footer_text||"";
  }catch(e){console.error(e);}
}

async function saveSiteInfo(){
  try{
    const social={Twitter:document.getElementById("setSocialTwitter").value||null,Instagram:document.getElementById("setSocialInstagram").value||null,YouTube:document.getElementById("setSocialYoutube").value||null,TikTok:document.getElementById("setSocialTiktok").value||null};
    Object.keys(social).forEach(k=>!social[k]&&delete social[k]);
    const {error}=await window.supabaseClient.from("site_settings").update({site_name:document.getElementById("setSiteName").value,description:document.getElementById("setDescription").value,logo_url:document.getElementById("setLogoUrl").value,favicon_url:document.getElementById("setFaviconUrl").value,contact_email:document.getElementById("setContactEmail").value,social:social}).eq("id",1);
    if(error)throw error;
    setMsg("siteMsg","Saved!");
    setTimeout(()=>setMsg("siteMsg",""),3000);
    applySiteSettings();
  }catch(e){setMsg("siteMsg","Error: "+e.message);}
}

function setupColorSwatches(){
  const colors=["#6d5efc","#3b82f6","#8b5cf6","#ec4899","#f59e0b","#10b981"];
  const html=colors.map(c=>`<div class="color-swatch" style="background:${c}" onclick="pickColor('${c}')" title="${c}"></div>`).join("");
  document.getElementById("colorSwatches").innerHTML=html;
}

window.pickColor=(c)=>{
  document.getElementById("setAccentColor").value=c;
  document.querySelectorAll(".color-swatch").forEach(sw=>sw.classList.toggle("selected",sw.style.background===c));
};

async function saveAppearance(){
  const color=document.getElementById("setAccentColor").value;
  try{
    const {error}=await window.supabaseClient.from("site_settings").update({accent_color:color}).eq("id",1);
    if(error)throw error;
    document.documentElement.style.setProperty("--accent",color);
    setMsg("appearanceMsg","Saved!");
    setTimeout(()=>setMsg("appearanceMsg",""),3000);
  }catch(e){setMsg("appearanceMsg","Error: "+e.message);}
}

async function loadNavigation(){
  try{
    const {data}=await window.supabaseClient.from("site_settings").select("nav_items").eq("id",1).maybeSingle();
    const items=data?.nav_items||[];
    const html=items.map((item,i)=>`<div class="nav-item-row"><input placeholder="Label" value="${esc(item.label)}" data-field="label" data-idx="${i}"><input placeholder="href" value="${esc(item.href)}" data-field="href" data-idx="${i}"><button onclick="removeNavItem(${i})">Remove</button></div>`).join("");
    document.getElementById("navItemRows").innerHTML=html;
  }catch(e){console.error(e);}
}

function addNavItem(){
  const rows=document.getElementById("navItemRows");
  const items=Array.from(rows.querySelectorAll(".nav-item-row")).map(row=>({label:row.querySelector('[data-field="label"]').value,href:row.querySelector('[data-field="href"]').value}));
  items.push({label:"",href:""});
  rows.innerHTML=items.map((item,i)=>`<div class="nav-item-row"><input placeholder="Label" value="${esc(item.label)}" data-field="label" data-idx="${i}"><input placeholder="href" value="${esc(item.href)}" data-field="href" data-idx="${i}"><button onclick="removeNavItem(${i})">Remove</button></div>`).join("");
}

window.removeNavItem=(idx)=>{
  const rows=document.getElementById("navItemRows");
  const items=Array.from(rows.querySelectorAll(".nav-item-row")).filter((_,i)=>i!==idx).map(row=>({label:row.querySelector('[data-field="label"]').value,href:row.querySelector('[data-field="href"]').value}));
  rows.innerHTML=items.map((item,i)=>`<div class="nav-item-row"><input placeholder="Label" value="${esc(item.label)}" data-field="label" data-idx="${i}"><input placeholder="href" value="${esc(item.href)}" data-field="href" data-idx="${i}"><button onclick="removeNavItem(${i})">Remove</button></div>`).join("");
};

async function saveNavigation(){
  const items=Array.from(document.querySelectorAll(".nav-item-row")).map(row=>({label:row.querySelector('[data-field="label"]').value,href:row.querySelector('[data-field="href"]').value})).filter(x=>x.label&&x.href);
  try{
    const {error}=await window.supabaseClient.from("site_settings").update({nav_items:items}).eq("id",1);
    if(error)throw error;
    setMsg("navMsg","Saved!");
    setTimeout(()=>setMsg("navMsg",""),3000);
    applySiteSettings();
  }catch(e){setMsg("navMsg","Error: "+e.message);}
}

async function saveFooter(){
  try{
    const {error}=await window.supabaseClient.from("site_settings").update({footer_text:document.getElementById("setFooterText").value}).eq("id",1);
    if(error)throw error;
    setMsg("footerMsg","Saved!");
    setTimeout(()=>setMsg("footerMsg",""),3000);
    applySiteSettings();
  }catch(e){setMsg("footerMsg","Error: "+e.message);}
}

async function promoteToAdmin(){
  const email=document.getElementById("promoteEmail").value.trim();
  if(!email)return alert("Enter an email.");
  try{
    const {data:user}=await window.supabaseClient.auth.admin.getUserByEmail(email);
    if(!user)throw new Error("User not found.");
    await window.supabaseClient.from("profiles").update({role:"admin"}).eq("id",user.id);
    setMsg("promoteMsg",email+" is now admin.");
    document.getElementById("promoteEmail").value="";
    setTimeout(()=>setMsg("promoteMsg",""),3000);
    await loadUsers();
  }catch(e){setMsg("promoteMsg","Error: "+e.message);}
}

function setMsg(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}
