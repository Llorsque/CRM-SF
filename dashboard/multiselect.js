
// Tiny multiselect with checkboxes
(function(){
  function create(el, {options=[], onChange}){
    el.classList.add('ms');
    const toggle=document.createElement('button');
    toggle.type='button'; toggle.className='ms-toggle'; toggle.textContent='Alles';
    const panel=document.createElement('div'); panel.className='ms-panel';
    const search=document.createElement('div'); search.className='ms-search';
    const si=document.createElement('input'); si.placeholder='Zoek...'; search.appendChild(si);
    panel.appendChild(search);
    const list=document.createElement('div'); panel.appendChild(list);
    el.appendChild(toggle); el.appendChild(panel);

    let selected=new Set();
    function renderList(filter=''){
      list.innerHTML='';
      const items=options.filter(v=>v.toLowerCase().includes(filter.toLowerCase()));
      items.forEach(v=>{
        const row=document.createElement('label'); row.className='ms-item';
        const cb=document.createElement('input'); cb.type='checkbox'; cb.value=v; cb.checked=selected.has(v);
        const sp=document.createElement('span'); sp.textContent=v;
        row.appendChild(cb); row.appendChild(sp);
        cb.addEventListener('change',()=>{
          if(cb.checked) selected.add(v); else selected.delete(v);
          updateToggle(); onChange(Array.from(selected));
        });
        list.appendChild(row);
      });
    }
    function updateToggle(){
      toggle.textContent = selected.size? `${selected.size} geselecteerd` : 'Alles';
    }
    toggle.addEventListener('click',()=>{ el.classList.toggle('open'); });
    document.addEventListener('click',(e)=>{ if(!el.contains(e.target)) el.classList.remove('open'); });
    si.addEventListener('input',()=>renderList(si.value));
    renderList();
    return { setOptions:(opts)=>{ options=opts; renderList(si.value) }, getSelected:()=>Array.from(selected), setSelected:(arr)=>{ selected=new Set(arr||[]); updateToggle(); renderList(si.value) } };
  }
  window.MultiSelect = { create };
})();
