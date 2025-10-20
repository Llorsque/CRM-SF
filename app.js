// simple dropdown toggle with outside click close
const btn = document.getElementById('menuBtn');
const dropdown = btn.closest('.dropdown');

function closeAll(){
  dropdown.classList.remove('menu-open');
  btn.setAttribute('aria-expanded','false');
}

btn.addEventListener('click', (e)=>{
  e.stopPropagation();
  const isOpen = dropdown.classList.toggle('menu-open');
  btn.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', ()=> closeAll());
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape') closeAll();
});
