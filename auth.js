document.addEventListener("DOMContentLoaded",()=>{
  const login=document.getElementById("loginForm"), signup=document.getElementById("signupForm"), msg=document.getElementById("msg");
  const client=window.supabaseClient;
  if(!client){if(msg)msg.textContent="Add your Supabase publishable key in supabase-config.js first.";return;}
  if(login)login.onsubmit=async e=>{e.preventDefault();if(msg)msg.textContent="Signing in...";const {error}=await client.auth.signInWithPassword({email:email.value,password:password.value});if(error){if(msg)msg.textContent=error.message;return;}const params=new URLSearchParams(location.search);const returnTo=params.get('returnTo');location.href=returnTo||'index.html';};
  if(signup)signup.onsubmit=async e=>{e.preventDefault();if(msg)msg.textContent="Creating account...";const {data,error}=await client.auth.signUp({email:email.value,password:password.value,options:{data:{username:username.value,display_name:displayName.value}}});if(error){if(msg)msg.textContent=error.message;}else if(msg)msg.textContent=data.session?"Account created.":"Account created. Check your email if confirmation is enabled.";};
});
