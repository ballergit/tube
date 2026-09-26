const applyClient=window.supabaseClient;
document.addEventListener('DOMContentLoaded',async()=>{
  const form=document.getElementById('creatorApplyForm'),msg=document.getElementById('creatorApplyMsg');
  if(!applyClient){msg.textContent='Supabase is not connected.';return;}
  const {data:{user}}=await applyClient.auth.getUser();
  if(!user){location.href='login.html';return;}
  const {data:profile}=await applyClient.from('profiles').select('is_creator').eq('id',user.id).maybeSingle();
  if(profile?.is_creator){msg.textContent='Your account already has creator access.';form.querySelector('button').disabled=true;return;}
  const {data:pending}=await applyClient.from('creator_applications').select('status,country,reason').eq('user_id',user.id).eq('status','pending').maybeSingle();
  if(pending){
    document.getElementById('creatorCountry').value=pending.country||'';
    document.getElementById('creatorReason').value=pending.reason||'';
    msg.textContent='Your creator application is already pending review.';
    form.querySelector('button').disabled=true;
  }
  form.onsubmit=async e=>{
    e.preventDefault();
    msg.textContent='Submitting…';
    const {data,error}=await applyClient.rpc('vexa_apply_creator',{p_country:document.getElementById('creatorCountry').value.trim(),p_reason:document.getElementById('creatorReason').value.trim()});
    if(error){msg.textContent=error.message;return;}
    msg.textContent=data||'Application submitted for review.';
    form.querySelector('button').disabled=true;
  };
});
