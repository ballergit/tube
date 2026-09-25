(function(){
 const root=document.documentElement;
 const saved=localStorage.getItem('theme');
 if(saved==='dark') root.classList.add('dark');
 const lang=localStorage.getItem('lang')||'en';
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{root.classList.toggle('dark');localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light')}));
  document.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>document.body.classList.toggle('menu-open')));
  document.querySelectorAll('[data-overlay]').forEach(x=>x.addEventListener('click',()=>document.body.classList.remove('menu-open')));
  document.querySelectorAll('[data-lang]').forEach(s=>{s.value=lang;s.addEventListener('change',()=>localStorage.setItem('lang',s.value))});
  const page=location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.side-link').forEach(a=>{if(a.getAttribute('href')===page)a.classList.add('active')});
 });
})();
