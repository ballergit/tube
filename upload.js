const client=window.supabaseClient;
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("uploadForm"),msg=document.getElementById("msg"),type=document.getElementById("contentType"),mediaInput=document.getElementById("mediaFile"),help=document.getElementById("mediaFileHelp");
  if(!form)return;
  type.onchange=()=>{
    const isVideo=type.value==='video';
    mediaInput.accept=isVideo?'video/*':'image/*';
    mediaInput.multiple=!isVideo;
    document.getElementById("thumbFile").disabled=!isVideo;
    if(help)help.textContent=isVideo?'Select one video file.':'For photos, you can select multiple pictures at once.';
  };
  form.onsubmit=async e=>{
    e.preventDefault();
    msg.textContent="Uploading...";
    if(!client){msg.textContent="Supabase is not connected.";return;}
    const {data:{user}}=await client.auth.getUser();
    if(!user){location.href='login.html';return;}
    const files=Array.from(mediaInput.files||[]);
    if(!files.length){msg.textContent='Choose at least one file.';return;}
    const isVideo=type.value==='video';
    if(isVideo&&files.length>1){msg.textContent='Please select only one video.';return;}

    const profile=await client.from('profiles').select('display_name,username').eq('id',user.id).maybeSingle();
    const uploaderName=profile.data?.display_name||profile.data?.username||user.email?.split('@')[0]||'Creator';
    const baseTitle=document.getElementById('title').value.trim();
    const description=document.getElementById('description').value.trim();
    const category=document.getElementById('category').value.trim()||'General';
    const tags=document.getElementById('tags').value.split(',').map(x=>x.trim()).filter(Boolean);

    let completed=0;
    for(const file of files){
      const slug=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const bucket=isVideo?'videos':'photos';
      const up=await client.storage.from(bucket).upload(slug,file,{upsert:false,contentType:file.type});
      if(up.error){msg.textContent=up.error.message;return;}
      const mediaUrl=client.storage.from(bucket).getPublicUrl(slug).data.publicUrl;
      let thumbUrl=null;
      const thumb=document.getElementById("thumbFile").files[0];
      if(isVideo&&thumb){
        const tslug=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-thumb-${thumb.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const tu=await client.storage.from('thumbnails').upload(tslug,thumb,{upsert:false,contentType:thumb.type});
        if(tu.error){msg.textContent=tu.error.message;return;}
        thumbUrl=client.storage.from('thumbnails').getPublicUrl(tslug).data.publicUrl;
      }
      const row={
        title:baseTitle||file.name.replace(/\.[^.]+$/,''),
        description,category,tags,uploader_id:user.id,uploader_name:uploaderName,status:'pending',submitted_at:new Date().toISOString()
      };
      const result=isVideo
        ? await client.from('videos').insert({...row,video_url:mediaUrl,thumbnail_url:thumbUrl}).select().single()
        : await client.from('photos').insert({...row,image_url:mediaUrl,thumbnail_url:thumbUrl}).select().single();
      if(result.error){msg.textContent=result.error.message;return;}
      completed++;
      msg.textContent=`Uploading ${completed}/${files.length}...`;
    }
    form.reset();
    type.onchange();
    msg.textContent=`${completed} ${isVideo?'video':'photo'+(completed===1?'':'s')} submitted. An admin must approve it before it appears publicly.`;
  };
  type.onchange();
});
