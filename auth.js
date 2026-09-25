document.addEventListener("DOMContentLoaded",()=>{
  const login=document.getElementById("loginForm"), signup=document.getElementById("signupForm"), msg=document.getElementById("msg");
  const client=window.supabaseClient;
  if(!client){msg.textContent="Add your Supabase publishable key in supabase-config.js first.";return;}
  if(login)login.onsubmit=async e=>{e.preventDefault();msg.textContent="Signing in...";const {error}=await client.auth.signInWithPassword({email:email.value,password:password.value});if(error)msg.textContent=error.message;else location.href="index.html";};
  if(signup)signup.onsubmit=async e=>{e.preventDefault();msg.textContent="Creating account...";const {data,error}=await client.auth.signUp({email:email.value,password:password.value,options:{data:{username:username.value,display_name:displayName.value}}});if(error)msg.textContent=error.message;else msg.textContent=data.session?"Account created.":"Account created. Check your email if confirmation is enabled.";};
});