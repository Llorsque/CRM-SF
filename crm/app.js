import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
document.getElementById('envWarning').style.display = (SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT')) ? 'none' : 'inline-block';

const q = (s, el=document)=>el.querySelector(s);
const qq = (s, el=document)=>Array.from(el.querySelectorAll(s));

const elCards = q('#cards');
const elQ = q('#q');
const elTotals = q('#totals');

const mselDefs = [
  { key: 'municipality', label: 'Gemeente', selector: '[data-key=\"municipality\"]' },
  { key: 'city',         label: 'Plaats',   selector: '[data-key=\"city\"]' },
  { key: 'sport',        label: 'Sport',    selector: '[data-key=\"sport\"]' },
  { key: 'profit',       label: 'Profit/Non-profit', selector: '[data-key=\"profit\"]' },
];
const mselState = { municipality:new Set(), city:new Set(), sport:new Set(), profit:new Set() };

const PAGE_SIZE = 16;
let currentPage = 1;
let totalCount = 0;
let allRows = [];
let filteredRows = [];

q('#btnClear').addEventListener('click', ()=>{
  elQ.value=''; for(const k in mselState) mselState[k].clear();
  updateMselLabels(); currentPage=1; render();
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

// ---- NEW: normalize coords ----
function normalizeCoords(lat, lng){
  let a = parseFloat(lat), b = parseFloat(lng);
  if(Number.isNaN(a) || Number.isNaN(b)) return {lat:null, lng:null};
  // if clearly invalid for latitude, swap
  if(Math.abs(a) > 90 && Math.abs(b) <= 90){ const tmp=a; a=b; b=tmp; }
  // simple NL heuristic: if |a| < |b| (e.g., 5,53) assume swapped
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
    if(data.length < CHUNK) break;
    from += CHUNK;
  }
  buildFilterOptions();
}

function buildFilterOptions(){
  const sets = { municipality:new Set(), city:new Set(), sport:new Set(), profit:new Set(['Non-profit','Profit','Onbekend']) };
  allRows.forEach(r=>{ if(r.municipality) sets.municipality.add(r.municipality); if(r.city) sets.city.add(r.city); if(r.sport) sets.sport.add(r.sport); });
  mselDefs.forEach(def=>{
    const root = q(def.selector), menu = root.querySelector('.msel-menu'); menu.innerHTML='';
    const header = document.createElement('div'); header.className='header';
    const txt = document.createElement('span'); txt.className='muted'; txt.textContent='Meervoudige selectie';
    const clr = document.createElement('button'); clr.className='btn ghost'; clr.type='button'; clr.textContent='Wissen';
    clr.addEventListener('click', (e)=>{ e.stopPropagation(); mselState[def.key].clear(); updateMselLabels(); currentPage=1; render(); });
    header.appendChild(txt); header.appendChild(clr); menu.appendChild(header);
    Array.from(sets[def.key]).sort((a,b)=>a.localeCompare(b)).forEach(val=>{
      const row = document.createElement('label'); row.className='opt';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = mselState[def.key].has(val);
      cb.addEventListener('change', (e)=>{ if(e.target.checked) mselState[def.key].add(val); else mselState[def.key].delete(val); updateMselLabels(); currentPage=1; render(); });
      const span = document.createElement('span'); span.textContent = val;
      row.appendChild(cb); row.appendChild(span); menu.appendChild(row);
    });
  });
  updateMselLabels();
}
function updateMselLabels(){ mselDefs.forEach(def=>{ const btn = q(def.selector+' .msel-btn'); const n = mselState[def.key].size; btn.textContent = n? `${def.label} (${n}) ▾` : `${def.label} ▾`; }); }

function applyFilters(){
  const qv = elQ.value.trim().toLowerCase();
  filteredRows = allRows.filter(r=>{
    if(qv){ const hay = [r.name,r.sport,r.municipality,r.city,r.type].join(' ').toLowerCase(); if(!hay.includes(qv)) return false; }
    if(mselState.municipality.size && !mselState.municipality.has(r.municipality)) return false;
    if(mselState.city.size && !mselState.city.has(r.city)) return false;
    if(mselState.sport.size && !mselState.sport.has(r.sport)) return false;
    if(mselState.profit.size && !mselState.profit.has(profitLabel(r.type))) return false;
    return true;
  });
}

function render(){
  applyFilters();
  const total = filteredRows.length, totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE, pageRows = filteredRows.slice(start, start + PAGE_SIZE);
  elTotals.textContent = `Totaal ${allRows.length} • Gefilterd ${filteredRows.length}`;
  elCards.innerHTML='';
  const tpl = q('#cardTpl');
  pageRows.forEach(r=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.club-title').textContent = r.name || '(naam onbekend)';
    const t = profitLabel(r.type), badge = node.querySelector('.badge.type');
    badge.textContent = t; badge.classList.add(t==='Profit'?'profit': t==='Non-profit'?'nonprofit':'unknown');
    node.querySelector('.sport').textContent = r.sport || 'Onbekend';
    node.querySelector('.municipality').textContent = r.municipality || 'Onbekend';
    node.querySelector('.city').textContent = r.city || 'Onbekend';
    node.querySelector('.canteen').textContent = r.has_canteen===true ? 'Ja' : r.has_canteen===false ? 'Nee' : 'Onbekend';
    node.querySelector('.details').addEventListener('click', ()=>openDetails(r));
    elCards.appendChild(node);
  });
  q('#pageInfo').textContent = `Pagina ${currentPage} / ${Math.max(1,totalPages)}`;
  q('#prevPage').disabled = currentPage<=1; q('#nextPage').disabled = currentPage>=totalPages;
}
q('#prevPage').addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; render(); } });
q('#nextPage').addEventListener('click', ()=>{ currentPage++; render(); });

function exportCSV(rows){
  const header = ['id_code','name','sport','municipality','city','type','has_canteen','postal_code','latitude','longitude'];
  const lines = [header.join(',')];
  rows.forEach(r=>{
    const vals = header.map(k=>{ let v=r[k]; if(typeof v==='boolean') v = v?'true':'false'; if(v==null) v=''; return '\"'+String(v).replace(/\"/g,'\"\"')+'\"'; });
    lines.push(vals.join(','));
  });
  const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='crm_export.csv'; a.click(); URL.revokeObjectURL(url);
}

let map, marker;
function ensureMap(lat, lng){
  const el = document.getElementById('miniMap');
  const n = normalizeCoords(lat, lng);
  if(n.lat==null || n.lng==null){ el.innerHTML='<div style=\"padding:12px;color:#6b7280\">Geen coördinaten beschikbaar</div>'; return; }
  if(!map){
    map = L.map(el).setView([n.lat, n.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap' }).addTo(map);
    marker = L.marker([n.lat, n.lng]).addTo(map);
  } else {
    map.setView([n.lat, n.lng], 13);
    marker.setLatLng([n.lat, n.lng]);
  }
  setTimeout(()=>{ map.invalidateSize(); }, 50);
}

function openDetails(r){
  const dlg = q('#detailsDialog');
  const n = normalizeCoords(r.latitude, r.longitude);
  q('#dlgTitle').textContent = r.name || 'Details';
  q('#dlgSport').textContent = r.sport || '—';
  q('#dlgMunicipality').textContent = r.municipality || '—';
  q('#dlgCity').textContent = r.city || '—';
  q('#dlgType').textContent = r.type || '—';
  q('#dlgCanteen').textContent = r.has_canteen===true ? 'Ja' : r.has_canteen===false ? 'Nee' : 'Onbekend';
  q('#dlgPostcode').textContent = r.postal_code || '—';
  q('#dlgGeo').textContent = (n.lat!=null && n.lng!=null) ? `${n.lat}, ${n.lng}` : '—';
  q('#dlgId').textContent = r.id_code || '—';

  // Attributen
  const el = q('#attrList'); el.innerHTML='';
  const attrs = r.attributes || {};
  const entries = Object.entries(attrs).filter(([k,v])=>v!==null && v!=='' && v!==undefined).sort(([a],[b])=>a.localeCompare(b));
  if(entries.length===0){ el.textContent='(geen overige attributen)'; }
  else{
    entries.forEach(([k,v])=>{
      const row=document.createElement('div'); row.className='attr-item';
      const kk=document.createElement('div'); kk.className='k'; kk.textContent=k;
      const vv=document.createElement('div'); vv.className='v'; vv.textContent=(v==='0'?'Nee':v==='1'?'Ja':String(v));
      row.appendChild(kk); row.appendChild(vv); el.appendChild(row);
    });
  }

  ensureMap(r.latitude, r.longitude);
  q('#dlgClose').onclick = ()=>dlg.close();
  dlg.showModal();
}

// Init
await loadData();
render();
