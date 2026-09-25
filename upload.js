document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("uploadForm"),msg=document.getElementById("msg"),c=window.supabaseClient;
  if(!c){msg.textContent="Add your Supabase publishable key first.";return;}
  form.onsubmit=async e=>{
    e.preventDefault();msg.textContent="Saving...";
    const {data:{user}}=await c.auth.getUser();
    if(!user){location.href="login.html";return;}
    const {error}=await c.from("videos").insert({user_id:user.id,title:title.value,description:description.value,video_url:videoUrl.value,thumbnail_url:thumbnailUrl.value||null,preview_url:previewUrl.value||null,category_id:Number(categoryId.value)||null,status:"published"});
    msg.textContent=error?error.message:"Video metadata published successfully.";
  };
});