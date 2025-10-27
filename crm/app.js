import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Supabase init
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
document.getElementById('envWarning').style.display =
  (SUPABASE_URL && !SUPABASE_URL.includes('YOUR-PROJECT')) ? 'none' : 'inline-block';

// Helpers
const q = (s, el=document)=>el.querySelector(s);
const qq = (s, el=document)=>Array.from(el.querySelectorAll(s));
const elCards = q('#cards');
const elQ = q('#q');
const elTotals = q('#totals');

function capFirst(s){ if(!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }
function capAllWords(s){ if(!s) return s; return s.replace(/(^|\s)\p{L}/gu, m=>m.toUpperCase()); }
function humanizeKey(k){
  return (k||'').replace(/_/g,' ').replace(/\s+/g,' ')
    .replace(/(^|\s)\p{L}/gu, m=>m.toUpperCase()).replace(/\'/g,'’');
}
function profitLabel(type){
  const t = (type || '').toLowerCase();
  if(t.includes('non') || t.includes('stich') || t.includes('verenig')) return 'Non-profit';
  if(t.includes('profit') || t.includes('bedrijf') || t.includes('bv') || t.includes('vof')) return 'Profit';
  return 'Onbekend';
}
function normalizeCoords(lat, lng){
  let a = parseFloat(lat), b = parseFloat(lng);
  if(Number.isNaN(a) || Number.isNaN(b)) return {lat:null, lng:null};
  if(Math.abs(a) > 90 && Math.abs(b) <= 90){ const t=a; a=b; b=t; }
  if(Math.abs(a) < Math.abs(b) && Math.abs(b) <= 90){ const t=a; a=b; b=t; }
  return { lat:a, lng:b };
}

// Filters
const mselDefs = [
  { key:'municipality', label:'Gemeente', selector:'[data-key="municipality"]' },
  { key:'city',         label:'Plaats',   selector:'[data-key="city"]' },
  { key:'sport',        label:'Sport',    selector:'[data-key="sport"]' },
  { key:'profit',       label:'Profit/Non-profit', selector:'[data-key="profit"]' },
  { key:'canteen',      label:'Eigen Kantine', selector:'[data-key="canteen"]' },
  { key:'attrs',        label:'Attributen', selector:'[data-key="attrs"]' },
];
const mselState = { municipality:new Set(), city:new Set(), sport:new Set(), profit:new Set(), canteen:new Set(), attrs:new Set() };
let attrLabelToKey = new Map();

// Paging
const PAGE_SIZE = 16;
let currentPage = 1;
let totalCount = 0;
let allRows = [];
let filteredRows = [];

// Buttons
q('#btnClear').addEventListener('click', ()=>{
  elQ.value=''; for(const k in mselState) mselState[k].clear();
  currentPage=1; buildFilterOptions(); updateMselLabels(); render();
});
q('#btnRefresh').addEventListener('click', async ()=>{ await loadData(true); currentPage=1; render(); });
q('#btnExport').addEventListener('click', ()=>exportCSV(filteredRows));

document.addEventListener('click', (e)=>{
  const m = e.target.closest('.msel'); qq('.msel').forEach(el=>{ if(el!==m) el.classList.remove('open'); });
  if(m && e.target.closest('.msel-btn')) m.classList.toggle('open');
});
elQ.addEventListener('input', ()=>{ currentPage=1; render(); });

// Data load
async function loadData(force=false){
  if(allRows.length && !force) return;
  allRows = []; totalCount = 0;
  const CHUNK = 1000; let from = 0; let firstCountSet = false;
  while(true){
    const { data, error, count } = await supabase
      .from('organizations')
      .select('id_code,name,type,sport,municipality,city,postal_code,has_canteen,latitude,longitude,attributes', { count:'exact' })
      .range(from, from + CHUNK - 1);
    if(error){ console.error(error); alert('Fout bij laden data'); break; }
    if(!firstCountSet){ totalCount = count || 0; firstCountSet = true; }
    if(!data || data.length===0) break;
    allRows.push(...data);
    if(data.length < CHUNK) break; from += CHUNK;
  }
  buildFilterOptions();
}

// Build filter menus (City depends on Municipality)
function buildFilterOptions(){
  const sets = {
    municipality:new Set(),
    city:new Set(),
    sport:new Set(),
    profit:new Set(['Non-profit','Profit','Onbekend']),
    canteen:new Set(['Ja','Nee','Onbekend']),
    attrs:new Set(),
  };
  attrLabelToKey = new Map();

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

  // City limited by selected municipalities (if any)
  const muniSel = mselState.municipality;
  const rowsForCities = (muniSel.size>0) ? allRows.filter(r=>muniSel.has(r.municipality)) : allRows;
  rowsForCities.forEach(r=>{ if(r.city) sets.city.add(r.city); });

  // Drop invalid city selections
  if(mselState.city.size){
    const allowed = sets.city;
    [...mselState.city].forEach(v=>{ if(!allowed.has(v)) mselState.city.delete(v); });
  }

  // Render menus
  mselDefs.forEach(def=>{
    const root = q(def.selector); if(!root) return;
    const menu = root.querySelector('.msel-menu'); menu.innerHTML='';
    const header = document.createElement('div'); header.className='header';
    const count = document.createElement('span'); count.className='muted'; count.textContent='Meervoudige selectie';
    const clearBtn = document.createElement('button'); clearBtn.className='btn ghost'; clearBtn.type='button'; clearBtn.textContent='Wissen';
    clearBtn.addEventListener('click', (e)=>{
      e.stopPropagation(); mselState[def.key].clear(); updateMselLabels();
      if(def.key==='municipality') buildFilterOptions();
      currentPage=1; render();
    });
    header.appendChild(count); header.appendChild(clearBtn); menu.appendChild(header);

    Array.from(sets[def.key]).sort((a,b)=>a.localeCompare(b)).forEach(val=>{
      const row = document.createElement('label'); row.className='opt';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = mselState[def.key].has(val);
      cb.addEventListener('change', (e)=>{
        if(e.target.checked) mselState[def.key].add(val); else mselState[def.key].delete(val);
        updateMselLabels(); if(def.key==='municipality') buildFilterOptions(); currentPage=1; render();
      });
      const span = document.createElement('span'); span.textContent = val;
      row.appendChild(cb); row.appendChild(span); menu.appendChild(row);
    });
  });
  updateMselLabels();
}

function updateMselLabels(){
  mselDefs.forEach(def=>{
    const root = q(def.selector); if(!root) return;
    const btn = root.querySelector('.msel-btn'); const sel = mselState[def.key];
    btn.textContent = sel.size ? `${def.label} (${sel.size}) ▾` : `${def.label} ▾`;
  });
}

// Filtering
function applyFilters(){
  const qv = elQ.value.trim().toLowerCase();
  filteredRows = allRows.filter(r=>{
    if(qv){
      const hay = [r.name,r.sport,r.municipality,r.city,r.type].join(' ').toLowerCase();
      if(!hay.includes(qv)) return false;
    }
    if(mselState.municipality.size && !mselState.municipality.has(r.municipality)) return false;
    if(mselState.city.size && !mselState.city.has(r.city)) return false;
    if(mselState.sport.size && !mselState.sport.has(r.sport)) return false;
    if(mselState.profit.size && !mselState.profit.has(profitLabel(r.type))) return false;

    if(mselState.canteen.size){
      const v = (r.has_canteen===true) ? 'Ja' : (r.has_canteen===false) ? 'Nee' : 'Onbekend';
      if(!mselState.canteen.has(v)) return false;
    }
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

// Render
function render(){
  applyFilters();
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

  elTotals.textContent = `Totaal ${allRows.length} • Gefilterd ${filteredRows.length}`;

  elCards.innerHTML='';
  const tpl = q('#cardTpl');
  pageRows.forEach(r=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.club-title').textContent = capAllWords(r.name || '(naam onbekend)');
    const t = profitLabel(r.type);
    const badge = node.querySelector('.badge.type');
    badge.textContent = t; badge.classList.add(t==='Profit'?'profit': t==='Non-profit'?'nonprofit':'unknown');
    node.querySelector('.sport').textContent = capFirst(r.sport) || 'Onbekend';
    node.querySelector('.municipality').textContent = capAllWords(r.municipality) || 'Onbekend';
    node.querySelector('.city').textContent = capAllWords(r.city) || 'Onbekend';
    node.querySelector('.canteen').textContent = r.has_canteen===true ? 'Ja' : r.has_canteen===false ? 'Nee' : 'Onbekend';
    node.querySelector('.details').addEventListener('click', ()=>openDetails(r));
    elCards.appendChild(node);
  });

  q('#pageInfo').textContent = `Pagina ${currentPage} / ${Math.max(1,totalPages)}`;
  q('#prevPage').disabled = currentPage<=1; q('#nextPage').disabled = currentPage>=totalPages;
}
q('#prevPage').addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; render(); } });
q('#nextPage').addEventListener('click', ()=>{ currentPage++; render(); });

// CSV
function exportCSV(rows){
  const header = ['id_code','name','sport','municipality','city','type','has_canteen','postal_code','latitude','longitude'];
  const lines = [header.join(',')];
  rows.forEach(r=>{
    const vals = header.map(k=>{
      let v=r[k]; if(typeof v==='boolean') v = v?'true':'false'; if(v==null) v='';
      return '\"'+String(v).replace(/\"/g,'\"\"')+'\"';
    });
    lines.push(vals.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='crm_export.csv'; a.click(); URL.revokeObjectURL(url);
}

// ===== Details view (MAP + ATTRIBUTEN + TRAJECTEN + DOCUMENTEN) =====
let map, marker;
function ensureMap(lat, lng){
  const el = document.getElementById('miniMap');
  const n = normalizeCoords(lat, lng);
  if(n.lat==null || n.lng==null){ el.innerHTML='<div style="padding:12px;color:#6b7280">Geen coördinaten beschikbaar</div>'; return; }
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

function prettifyValue(v){
  if(v === null || v === undefined || v === '') return '—';
  if(v === '0') return 'Nee';
  if(v === '1') return 'Ja';
  return capFirst(String(v));
}
function renderAttributes(obj){
  const left = q('#attrColA'); const right = q('#attrColB');
  left.innerHTML=''; right.innerHTML='';
  if(!obj || typeof obj !== 'object'){ left.textContent='(geen overige attributen)'; right.textContent=''; return; }
  const entries = Object.entries(obj)
    .filter(([k,v])=> v!==null && v!=='' && v!==undefined)
    .sort(([a],[b])=> a.localeCompare(b));
  const half = Math.ceil(entries.length/2);
  [entries.slice(0,half), entries.slice(half)].forEach((col, idx)=>{
    const target = idx===0 ? left : right;
    col.forEach(([k,v])=>{
      const row = document.createElement('div'); row.className='ar';
      const kk = document.createElement('div'); kk.className='k'; kk.textContent = humanizeKey(k);
      const vv = document.createElement('div'); vv.className='v'; vv.textContent = prettifyValue(v);
      row.appendChild(kk); row.appendChild(vv); target.appendChild(row);
    });
  });
}

// Trajecten
async function loadTracks(orgId){
  const list = q('#tracksList'); list.innerHTML='<span class="muted">Laden…</span>';
  try{
    const { data, error } = await supabase.from('trajecten')
      .select('id, org_id, titel, status, start_datum, eind_datum')
      .eq('org_id', orgId).order('start_datum', { ascending:false });
    if(error || !data || data.length===0){ list.innerHTML='<span class="muted">Nog geen trajecten gekoppeld.</span>'; return; }
    list.innerHTML='';
    data.forEach(t=>{
      const pill = document.createElement('div'); pill.className='track-pill';
      const label=document.createElement('div'); label.textContent = capAllWords(t.titel || 'Traject');
      const status=document.createElement('span'); status.className='track-status'; status.textContent = capFirst(t.status || 'open');
      const dates=document.createElement('div'); dates.className='muted'; dates.textContent=[t.start_datum,t.eind_datum].filter(Boolean).join(' → ');
      pill.appendChild(label); pill.appendChild(status); pill.appendChild(dates); list.appendChild(pill);
    });
  }catch(_){ list.innerHTML='<span class="muted">Nog geen trajecten gekoppeld.</span>'; }
}

// Documenten (Supabase Storage)
const BUCKET = 'club-docs';
async function listDocs(orgId){
  const dl = q('#docsList'); const hint = q('#docsHint');
  if(!dl) return;
  dl.innerHTML='<span class="muted">Laden…</span>'; hint.textContent='';
  try{
    const { data, error } = await supabase.storage.from(BUCKET).list(orgId, { limit:100 });
    if(error){ dl.innerHTML='Geen documenten of bucket ontbreekt.'; hint.textContent='Maak in Storage een public bucket \"club-docs\".'; return; }
    if(!data || data.length===0){ dl.textContent='Nog geen documenten.'; return; }
    dl.innerHTML='';
    data.forEach(f=>{
      const a=document.createElement('a');
      a.href = supabase.storage.from(BUCKET).getPublicUrl(`${orgId}/${f.name}`).data.publicUrl;
      a.target='_blank'; a.rel='noopener'; a.textContent=f.name; dl.appendChild(a);
    });
  }catch(_){ dl.innerHTML='Documenten konden niet worden geladen.'; }
}
async function uploadDoc(orgId){
  const input=q('#docFile'); const file=input?.files?.[0]; if(!file){ alert('Kies een bestand.'); return; }
  const path=`${orgId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert:false });
  if(error){ alert('Upload mislukt: '+error.message+'\nZorg dat bucket \"club-docs\" bestaat en public is.'); return; }
  input.value=''; await listDocs(orgId);
}

// Open Details
function openDetails(r){
  const dlg = q('#detailsDialog');
  const n = normalizeCoords(r.latitude, r.longitude);
  q('#dlgTitle').textContent = capAllWords(r.name || 'Details');
  q('#dlgSport').textContent = capFirst(r.sport) || '—';
  q('#dlgMunicipality').textContent = capAllWords(r.municipality) || '—';
  q('#dlgCity').textContent = capAllWords(r.city) || '—';
  q('#dlgType').textContent = capAllWords(r.type) || '—';
  q('#dlgCanteen').textContent = r.has_canteen===true ? 'Ja' : r.has_canteen===false ? 'Nee' : 'Onbekend';
  q('#dlgPostcode').textContent = r.postal_code || '—';
  q('#dlgGeo').textContent = (n.lat!=null && n.lng!=null) ? `${n.lat}, ${n.lng}` : '—';
  q('#dlgId').textContent = r.id_code || '—';

  // map + attrib + trajecten + docs
  if(window.L) ensureMap(r.latitude, r.longitude);
  renderAttributes(r.attributes);
  loadTracks(r.id_code);
  const btnUp = q('#btnUpload'); if(btnUp) btnUp.onclick = ()=>uploadDoc(r.id_code);
  listDocs(r.id_code);

  q('#dlgClose').onclick = ()=>dlg.close();

  // CRM augment: active club + inline Edit button
  try {
    window.activeClubId = r.id_code;
    const head = q('.dlg-head');
    if (head && !document.getElementById('crm-edit-inline')) {
      const btn = document.createElement('button');
      btn.id = 'crm-edit-inline';
      btn.className = 'btn';
      btn.type = 'button';
      btn.textContent = 'Bewerken';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        if (window.CRMUI){ CRMUI.setActiveClub(r.id_code); CRMUI.open(); }
      });
      head.appendChild(btn);
    } else if (window.CRMUI) {
      CRMUI.setActiveClub(r.id_code);
    }
  } catch(e) { console.warn('CRM augment (inline) faalde', e); }
  dlg.showModal();
}

// Init
await loadData();
render();
