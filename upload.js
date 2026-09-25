const client=window.supabaseClient;
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("uploadForm"),msg=document.getElementById("msg"),type=document.getElementById("contentType");
  document.getElementById("themeBtn")?.addEventListener("click",()=>{document.documentElement.classList.toggle("light");localStorage.setItem("vexa-theme",document.documentElement.classList.contains("light")?"light":"dark")});
  type.onchange=()=>{document.getElementById("mediaFile").accept=type.value==='video'?'video/*':'image/*';document.getElementById("thumbFile").disabled=type.value==='photo';};
  form.onsubmit=async e=>{
    e.preventDefault();msg.textContent="Uploading...";
    if(!client){msg.textContent="Supabase is not connected.";return;}
    const {data:{user}}=await client.auth.getUser(); if(!user){location.href='login.html';return;}
    const file=document.getElementById("mediaFile").files[0]; if(!file)return;
    const slug=`${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const bucket=type.value==='video'?'videos':'photos';
    let up=await client.storage.from(bucket).upload(slug,file,{upsert:false,contentType:file.type}); if(up.error){msg.textContent=up.error.message;return;}
    const mediaUrl=client.storage.from(bucket).getPublicUrl(slug).data.publicUrl;
    let thumbUrl=null;
    const thumb=document.getElementById("thumbFile").files[0];
    if(thumb){const tslug=`${user.id}/${Date.now()}-thumb-${thumb.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const tu=await client.storage.from('thumbnails').upload(tslug,thumb,{upsert:false,contentType:thumb.type});if(tu.error){msg.textContent=tu.error.message;return;}thumbUrl=client.storage.from('thumbnails').getPublicUrl(tslug).data.publicUrl;}
    const profile=await client.from('profiles').select('display_name,username').eq('id',user.id).maybeSingle();
    const uploaderName=profile.data?.display_name||profile.data?.username||user.email?.split('@')[0]||'Creator';
    const row={title:document.getElementById('title').value.trim(),description:document.getElementById('description').value.trim(),category:document.getElementById('category').value.trim()||'General',tags:document.getElementById('tags').value.split(',').map(x=>x.trim()).filter(Boolean),uploader_id:user.id,uploader_name:uploaderName,status:'pending',submitted_at:new Date().toISOString()};
    let result;
    if(type.value==='video') result=await client.from('videos').insert({...row,video_url:mediaUrl,thumbnail_url:thumbUrl}).select().single();
    else result=await client.from('photos').insert({...row,image_url:mediaUrl,thumbnail_url:thumbUrl}).select().single();
    if(result.error){msg.textContent=result.error.message;return;}
    form.reset();msg.textContent="Submitted. An admin must approve it before it appears publicly.";
  };
});
