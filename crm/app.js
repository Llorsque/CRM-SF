import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const envOk = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR-PROJECT');
document.getElementById('envWarning').style.display = envOk ? 'none' : 'inline-block';

const q = (s, el=document)=>el.querySelector(s);
const qq = (s, el=document)=>Array.from(el.querySelectorAll(s));

const elCards = q('#cards');
const elQ = q('#q');
const elTotals = q('#totals');

// Multi-select filter containers
const mselDefs = [
  { key: 'municipality', label: 'Gemeente', selector: '[data-key="municipality"]' },
  { key: 'city',         label: 'Plaats',   selector: '[data-key="city"]' },
  { key: 'sport',        label: 'Sport',    selector: '[data-key="sport"]' },
  { key: 'profit',       label: 'Profit/Non-profit', selector: '[data-key="profit"]' },
];
const mselState = {
  municipality: new Set(),
  city: new Set(),
  sport: new Set(),
  profit: new Set(),
};

// Pagination
const PAGE_SIZE = 16;
let currentPage = 1;

q('#btnClear').addEventListener('click', ()=>{
  elQ.value = '';
  for(const k in mselState){ mselState[k].clear(); }
  updateMselLabels();
  currentPage = 1;
  render();
});
q('#btnRefresh').addEventListener('click', async ()=>{
  await loadData(true);
  currentPage = 1;
  render();
});
q('#btnExport').addEventListener('click', ()=>{
  exportCSV(filteredRows);
});

// open/close menus
document.addEventListener('click', (e)=>{
  const msel = e.target.closest('.msel');
  qq('.msel').forEach(el => {
    if(el !== msel) el.classList.remove('open');
  });
  if(msel && e.target.closest('.msel-btn')){
    msel.classList.toggle('open');
  }
});

// Search input
elQ.addEventListener('input', ()=>{ currentPage = 1; render(); });

let allRows = [];
let filteredRows = [];

function profitLabel(type){
  const t = (type || '').toLowerCase();
  if(t.includes('non') || t.includes('stich') || t.includes('verenig')) return 'Non-profit';
  if(t.includes('profit') || t.includes('bedrijf') || t.includes('bv') || t.includes('vof')) return 'Profit';
  return 'Onbekend';
}

async function loadData(force=false){
  if(allRows.length && !force) return;
  const { data, error } = await supabase
    .from('organizations')
    .select('id_code,name,type,sport,municipality,city,postal_code,has_canteen,latitude,longitude,attributes')
    .limit(10000);
  if(error){ console.error(error); alert('Fout bij laden data'); return; }
  allRows = data || [];
  buildFilterOptions();
}

function buildFilterOptions(){
  const sets = {
    municipality: new Set(),
    city: new Set(),
    sport: new Set(),
    profit: new Set(['Non-profit','Profit','Onbekend']),
  };
  allRows.forEach(r=>{
    if(r.municipality) sets.municipality.add(r.municipality);
    if(r.city) sets.city.add(r.city);
    if(r.sport) sets.sport.add(r.sport);
  });

  mselDefs.forEach(def=>{
    const root = q(def.selector);
    const menu = root.querySelector('.msel-menu');
    menu.innerHTML = '';
    // header with Clear
    const header = document.createElement('div');
    header.className = 'header';
    const count = document.createElement('span');
    count.className = 'muted';
    count.textContent = 'Meervoudige selectie';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn ghost';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Wissen';
    clearBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      mselState[def.key].clear();
      updateMselLabels();
      currentPage = 1;
      render();
    });
    header.appendChild(count); header.appendChild(clearBtn);
    menu.appendChild(header);

    Array.from(sets[def.key]).sort((a,b)=>a.localeCompare(b)).forEach(val=>{
      const row = document.createElement('label');
      row.className = 'opt';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = mselState[def.key].has(val);
      cb.addEventListener('change', (e)=>{
        if(e.target.checked) mselState[def.key].add(val);
        else mselState[def.key].delete(val);
        updateMselLabels();
        currentPage = 1;
        render();
      });
      const span = document.createElement('span'); span.textContent = val;
      row.appendChild(cb); row.appendChild(span);
      menu.appendChild(row);
    });
  });

  updateMselLabels();
}

function updateMselLabels(){
  mselDefs.forEach(def=>{
    const root = q(def.selector);
    const btn = root.querySelector('.msel-btn');
    const sel = mselState[def.key];
    if(sel.size === 0){
      btn.textContent = def.label + ' ▾';
    } else if(sel.size === 1){
      btn.textContent = def.label + ' (1) ▾';
    } else {
      btn.textContent = `${def.label} (${sel.size}) ▾`;
    }
  });
}

function applyFilters(){
  const qv = elQ.value.trim().toLowerCase();

  filteredRows = allRows.filter(r=>{
    if(qv){
      const hay = [r.name, r.sport, r.municipality, r.city, r.type].join(' ').toLowerCase();
      if(!hay.includes(qv)) return false;
    }
    // municipality
    if(mselState.municipality.size){
      if(!mselState.municipality.has(r.municipality)) return false;
    }
    // city
    if(mselState.city.size){
      if(!mselState.city.has(r.city)) return false;
    }
    // sport
    if(mselState.sport.size){
      if(!mselState.sport.has(r.sport)) return false;
    }
    // profit
    if(mselState.profit.size){
      const pl = profitLabel(r.type);
      if(!mselState.profit.has(pl)) return false;
    }
    return true;
  });
}

function render(){
  applyFilters();

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

  elTotals.textContent = `Totaal ${allRows.length} • Gefilterd ${filteredRows.length}`;

  elCards.innerHTML = '';
  const tpl = q('#cardTpl');
  pageRows.forEach(r=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.club-title').textContent = r.name || '(naam onbekend)';
    const t = profitLabel(r.type);
    const badge = node.querySelector('.badge.type');
    badge.textContent = t;
    badge.classList.add(t==='Profit' ? 'profit' : t==='Non-profit' ? 'nonprofit' : 'unknown');
    node.querySelector('.sport').textContent = r.sport || 'Onbekend';
    node.querySelector('.municipality').textContent = r.municipality || 'Onbekend';
    node.querySelector('.city').textContent = r.city || 'Onbekend';
    node.querySelector('.canteen').textContent = r.has_canteen === true ? 'Ja' : r.has_canteen === false ? 'Nee' : 'Onbekend';

    const btn = node.querySelector('.details');
    btn.addEventListener('click', ()=>openDetails(r));
    elCards.appendChild(node);
  });

  // pagination controls
  q('#pageInfo').textContent = `Pagina ${currentPage} / ${totalPages}`;
  q('#prevPage').disabled = currentPage <= 1;
  q('#nextPage').disabled = currentPage >= totalPages;
}

q('#prevPage').addEventListener('click', ()=>{
  if(currentPage > 1){ currentPage--; render(); }
});
q('#nextPage').addEventListener('click', ()=>{
  currentPage++; render();
});

function exportCSV(rows){
  const header = ['id_code','name','sport','municipality','city','type','has_canteen','postal_code','latitude','longitude'];
  const lines = [header.join(',')];
  rows.forEach(r=>{
    const vals = header.map(k=>{
      let v = r[k];
      if(typeof v === 'boolean') v = v ? 'true' : 'false';
      if(v==null) v = '';
      const s = String(v).replace(/"/g,'""');
      return '"' + s + '"';
    });
    lines.push(vals.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'crm_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function openDetails(r){
  const dlg = q('#detailsDialog');
  q('#dlgTitle').textContent = r.name || 'Details';
  q('#dlgSport').textContent = r.sport || '—';
  q('#dlgMunicipality').textContent = r.municipality || '—';
  q('#dlgCity').textContent = r.city || '—';
  q('#dlgType').textContent = r.type || '—';
  q('#dlgCanteen').textContent = r.has_canteen === true ? 'Ja' : r.has_canteen === false ? 'Nee' : 'Onbekend';
  q('#dlgPostcode').textContent = r.postal_code || '—';
  q('#dlgGeo').textContent = (r.latitude && r.longitude) ? `${r.latitude}, ${r.longitude}` : '—';
  q('#dlgId').textContent = r.id_code || '—';
  try{
    q('#dlgAttributes').textContent = r.attributes ? JSON.stringify(r.attributes, null, 2) : '(geen overige attributen)';
  }catch(e){
    q('#dlgAttributes').textContent = '(geen overige attributen)';
  }
  q('#dlgClose').onclick = ()=>dlg.close();
  dlg.showModal();
}

// Init
await loadData();
render();
