import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
document.getElementById('envWarning').style.display = (SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT')) ? 'none' : 'inline-block';

const q = (s, el=document)=>el.querySelector(s);
const qq = (s, el=document)=>Array.from(el.querySelectorAll(s));

const elCards = q('#cards');
const elQ = q('#q');
const elTotals = q('#totals');

function humanizeKey(k){
  return (k||'').replace(/_/g,' ').replace(/\s+/g,' ').replace(/(^|\s)\p{L}/gu, m=>m.toUpperCase()).replace(/\'/g,'’');
}

const mselDefs = [
  { key: 'municipality', label: 'Gemeente', selector: '[data-key="municipality"]' },
  { key: 'city',         label: 'Plaats',   selector: '[data-key="city"]' },
  { key: 'sport',        label: 'Sport',    selector: '[data-key="sport"]' },
  { key: 'profit',       label: 'Profit/Non-profit', selector: '[data-key="profit"]' },
  { key: 'canteen',      label: 'Eigen Kantine', selector: '[data-key="canteen"]' },
  { key: 'attrs',        label: 'Attributen', selector: '[data-key="attrs"]' },
];
const mselState = { municipality:new Set(), city:new Set(), sport:new Set(), profit:new Set(), canteen:new Set(), attrs:new Set() };

const PAGE_SIZE = 16;
let currentPage = 1;
let totalCount = 0;
let allRows = [];
let filteredRows = [];

// dynamic label->key map for attributes
let attrLabelToKey = new Map();

q('#btnClear').addEventListener('click', ()=>{
  elQ.value=''; for(const k in mselState) mselState[k].clear();
  updateMselLabels(); currentPage=1; buildFilterOptions(); render();
});
q('#btnRefresh').addEventListener('click', async ()=>{ await loadData(true); currentPage=1; render(); });
q('#btnExport').addEventListener('click', ()=>exportCSV(filteredRows));

document.addEventListener('click', (e)=>{
  const m = e.target.closest('.msel'); qq('.msel').forEach(el=>{ if(el!==m) el.classList.remove('open'); });
  if(m && e.target.closest('.msel-btn')) m.classList.toggle('open');
});
elQ.addEventListener('input', ()=>{ currentPage=1; render(); });

function profitLabel(type){
  const t = (type || '').toLowerCase();
  if(t.includes('non') || t.includes('stich') || t.includes('verenig')) return 'Non-profit';
  if(t.includes('profit') || t.includes('bedrijf') || t.includes('bv') || t.includes('vof')) return 'Profit';
  return 'Onbekend';
}
function normalizeCoords(lat, lng){
  let a = parseFloat(lat), b = parseFloat(lng);
  if(Number.isNaN(a) || Number.isNaN(b)) return {lat:null, lng:null};
  if(Math.abs(a) > 90 && Math.abs(b) <= 90){ const tmp=a; a=b; b=tmp; }
  if(Math.abs(a) < Math.abs(b) && Math.abs(b) <= 90){ const tmp=a; a=b; b=tmp; }
  return { lat: a, lng: b };
}

async function loadData(force=false){
  if(allRows.length && !force) return;
  allRows = []; totalCount = 0;
  const CHUNK = 1000; let from = 0; let firstCountSet = false;
  while(true){
    const { data, error, count } = await supabase
      .from('organizations')
      .select('id_code,name,type,sport,municipality,city,postal_code,has_canteen,latitude,longitude,attributes', { count: 'exact' })
      .range(from, from + CHUNK - 1);
    if(error){ console.error(error); alert('Fout bij laden data'); break; }
    if(!firstCountSet){ totalCount = count || 0; firstCountSet = true; }
    if(!data || data.length === 0) break;
    allRows.push(...data);
    if(data.length < CHUNK) break; from += CHUNK;
  }
  buildFilterOptions();
}

function buildFilterOptions(){
  // Build sets; City depends on selected Municipality
  const sets = {
    municipality:new Set(),
    city:new Set(),
    sport:new Set(),
    profit:new Set(['Non-profit','Profit','Onbekend']),
    canteen:new Set(['Ja','Nee','Onbekend']),
    attrs:new Set()
  };
  attrLabelToKey = new Map();

  // Municipalities & Sports from all rows
  allRows.forEach(r=>{
    if(r.municipality) sets.municipality.add(r.municipality);
    if(r.sport) sets.sport.add(r.sport);
    const at = r.attributes || {};
    for(const k in at){
      const label = humanizeKey(k);
      sets.attrs.add(label);
      attrLabelToKey.set(label, k);
    }
  });

  // Cities depend on selected municipalities, else all
  const muniSelected = mselState.municipality;
  const rowsForCities = (muniSelected.size > 0)
    ? allRows.filter(r => muniSelected.has(r.municipality))
    : allRows;
  rowsForCities.forEach(r => { if(r.city) sets.city.add(r.city); });

  // If selected cities no longer allowed (after municipality change), drop them
  if(mselState.city.size){
    const allowed = sets.city;
    [...mselState.city].forEach(v => { if(!allowed.has(v)) mselState.city.delete(v); });
  }

  // Render menus
  mselDefs.forEach(def=>{
    const root = q(def.selector);
    if(!root) return;
    const menu = root.querySelector('.msel-menu');
    menu.innerHTML = '';
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
      if(def.key === 'municipality'){ buildFilterOptions(); } // refresh cities when clearing municipality
      currentPage = 1; render();
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
        if(def.key === 'municipality'){ buildFilterOptions(); } // when municipality changes, rebuild city options
        currentPage = 1; render();
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
    if(!root) return;
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
    if(mselState.municipality.size && !mselState.municipality.has(r.municipality)) return false;
    if(mselState.city.size && !mselState.city.has(r.city)) return false;
    if(mselState.sport.size && !mselState.sport.has(r.sport)) return false;
    if(mselState.profit.size && !mselState.profit.has(profitLabel(r.type))) return false;

    // Canteen filter
    if(mselState.canteen.size){
      const v = (r.has_canteen===true) ? 'Ja' : (r.has_canteen===false) ? 'Nee' : 'Onbekend';
      if(!mselState.canteen.has(v)) return false;
    }

    // Attributes filter: require all selected attributes to be '1' (Ja)
    if(mselState.attrs.size){
      const attrs = r.attributes || {};
      for(const label of mselState.attrs){
        const key = attrLabelToKey.get(label);
        const val = attrs?.[key];
        if(!(val === 1 || val === '1' || val === true)) return false;
      }
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

  const totalText = `Totaal ${allRows.length} • Gefilterd ${filteredRows.length}`;
  elTotals.textContent = totalText;

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

  q('#pageInfo').textContent = `Pagina ${currentPage} / ${Math.max(1, totalPages)}`;
  q('#prevPage').disabled = currentPage <= 1;
  q('#nextPage').disabled = currentPage >= totalPages;
}

// Minimal details open kept as before
function openDetails(r){
  const dlg = q('#detailsDialog');
  q('#dlgTitle').textContent = r.name || 'Details';
  q('#dlgSport').textContent = r.sport || '—';
  q('#dlgMunicipality').textContent = r.municipality || '—';
  q('#dlgCity').textContent = r.city || '—';
  q('#dlgType').textContent = r.type || '—';
  q('#dlgCanteen').textContent = r.has_canteen === true ? 'Ja' : r.has_canteen === false ? 'Nee' : 'Onbekend';
  q('#dlgPostcode').textContent = r.postal_code || '—';
  const n = normalizeCoords(r.latitude, r.longitude);
  q('#dlgGeo').textContent = (n.lat!=null && n.lng!=null) ? `${n.lat}, ${n.lng}` : '—';
  q('#dlgId').textContent = r.id_code || '—';

  q('#dlgClose').onclick = ()=>dlg.close();
  dlg.showModal();
}

// Init
await loadData();
render();
