import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// init
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const envOk = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR-PROJECT');
document.getElementById('envWarning').style.display = envOk ? 'none' : 'inline-block';

// DOM
const q = (s, el=document)=>el.querySelector(s);
const qq = (s, el=document)=>Array.from(el.querySelectorAll(s));

const elCards = q('#cards');
const elQ = q('#q');
const elFMuni = q('#fMunicipality');
const elFCity = q('#fCity');
const elFSport = q('#fSport');
const elFProfit = q('#fProfit');
const elTotals = q('#totals');

q('#btnClear').addEventListener('click', ()=>{
  elQ.value=''; elFMuni.value=''; elFCity.value=''; elFSport.value=''; elFProfit.value='';
  render();
});
q('#btnRefresh').addEventListener('click', async ()=>{
  await loadData(true);
  render();
});
q('#btnExport').addEventListener('click', ()=>{
  exportCSV(filteredRows);
});

[elQ, elFMuni, elFCity, elFSport, elFProfit].forEach(el=>{
  el.addEventListener('input', ()=>render());
});

// Data
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
    .limit(5000);
  if(error){ console.error(error); alert('Fout bij laden data'); return; }
  allRows = data || [];
  buildFilterOptions();
}

function buildFilterOptions(){
  // Build distinct lists from allRows
  const muni = new Set(), city = new Set(), sport = new Set();
  allRows.forEach(r=>{
    if(r.municipality) muni.add(r.municipality);
    if(r.city) city.add(r.city);
    if(r.sport) sport.add(r.sport);
  });
  function fill(select, values){
    const sel = select;
    const cur = sel.value;
    sel.innerHTML = '<option value="">' + sel.options[0].text + '</option>';
    Array.from(values).sort((a,b)=>a.localeCompare(b)).forEach(v=>{
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
    sel.value = cur; // preserve if possible
  }
  fill(elFMuni, muni);
  fill(elFCity, city);
  fill(elFSport, sport);
}

function render(){
  const qv = elQ.value.trim().toLowerCase();
  const fm = elFMuni.value;
  const fc = elFCity.value;
  const fs = elFSport.value;
  const fp = elFProfit.value;

  filteredRows = allRows.filter(r=>{
    if(qv){
      const hay = [r.name, r.sport, r.municipality, r.city, r.type].join(' ').toLowerCase();
      if(!hay.includes(qv)) return false;
    }
    if(fm && r.municipality !== fm) return false;
    if(fc && r.city !== fc) return false;
    if(fs && r.sport !== fs) return false;
    if(fp){
      if(profitLabel(r.type) !== fp) return false;
    }
    return true;
  });

  elTotals.textContent = `Totaal ${allRows.length} clubs • Gefilterd ${filteredRows.length}`;

  elCards.innerHTML = '';
  const tpl = q('#cardTpl');
  filteredRows.forEach(r=>{
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
}

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

// init
await loadData();
render();
