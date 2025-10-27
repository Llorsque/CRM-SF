
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../crm/config.js';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{persistSession:false} });

const $ = (s, r=document)=>r.querySelector(s);

let map, cluster;
function initMap(){
  map = L.map('map',{scrollWheelZoom:true}).setView([52.2,5.3], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  cluster = L.markerClusterGroup();
  map.addLayer(cluster);
}

function pinPopup(r){
  const lines = [
    `<strong>${(r.name||'Onbekende club')}</strong>`,
    r.sport ? `${r.sport}` : '',
    [r.municipality, r.city].filter(Boolean).join(' – '),
    r.type ? `Type: ${r.type}` : '',
    (typeof r.has_canteen==='boolean') ? `Eigen kantine: ${r.has_canteen ? 'Ja' : 'Nee'}` : ''
  ].filter(Boolean);
  return lines.join('<br/>');
}

// Pagination helper
async function fetchAll(table, select, whereCb){
  const pageSize=1000; let from=0,to=pageSize-1,rows=[],more=true;
  while(more){
    let q=sb.from(table).select(select, {head:false});
    if(whereCb) q = whereCb(q);
    q = q.range(from,to);
    const { data, error } = await q;
    if(error) throw error;
    rows = rows.concat(data||[]);
    more = (data||[]).length===pageSize;
    from += pageSize; to += pageSize;
  }
  return rows;
}

// Load orgs + current attributes
let ALL_ORGS=[], ATTR_IDX=new Map();
async function loadData(){
  ALL_ORGS = await fetchAll('organizations','id_code,name,latitude,longitude,sport,municipality,city,type,has_canteen');
  const attrs = await fetchAll('v_current_attributes','org_id,attr_key,value');
  ATTR_IDX = new Map();
  (attrs||[]).forEach(a=>{
    if(a.value !== 1) return;
    if(!ATTR_IDX.has(a.org_id)) ATTR_IDX.set(a.org_id, new Set());
    ATTR_IDX.get(a.org_id).add(a.attr_key);
  });
}

// Multiselects
const state = { muni:[], city:[], sport:[], type:[], kantine:[], attr:[] };
const ms = {};

function buildMS(id, options, onChange){
  const el = document.getElementById(id);
  ms[id] = window.MultiSelect.create(el, { options, onChange });
}

function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b),'nl')); }

async function buildFilters(){
  const orgs = ALL_ORGS;
  buildMS('ms_muni',    uniq(orgs.map(o=>o.municipality)), v=>{ state.muni=v; refresh(); });
  buildMS('ms_city',    uniq(orgs.map(o=>o.city)), v=>{ state.city=v; refresh(); });
  buildMS('ms_sport',   uniq(orgs.map(o=>o.sport)), v=>{ state.sport=v; refresh(); });
  buildMS('ms_type',    uniq(orgs.map(o=>o.type)), v=>{ state.type=v; refresh(); });
  buildMS('ms_kantine', ['Ja','Nee'], v=>{ state.kantine=v; refresh(); });
  // Attributes: haal unieke lijst uit ATTR_IDX
  const attrKeys = uniq(Array.from(new Set(Array.from(ATTR_IDX.values()).flatMap(s=>Array.from(s)))));
  buildMS('ms_attr', attrKeys.length?attrKeys:['nieuwsbrief_ontvangen','sociaal_veilig'], v=>{ state.attr=v; refresh(); });
}

function filterOrgs(){
  return ALL_ORGS.filter(o=>{
    if(!o.latitude || !o.longitude) return false;
    const okMuni = !state.muni.length || state.muni.includes(o.municipality);
    const okCity = !state.city.length || state.city.includes(o.city);
    const okSport= !state.sport.length || state.sport.includes(o.sport);
    const okType = !state.type.length || state.type.includes(o.type);
    const okKant = !state.kantine.length || state.kantine.includes(o.has_canteen ? 'Ja' : 'Nee');
    const okAttr = !state.attr.length || (function(){
      const set = ATTR_IDX.get(o.id_code) || new Set();
      // AND: alle gekozen attributen moeten aanwezig zijn
      return state.attr.every(k=>set.has(k));
    })();
    return okMuni && okCity && okSport && okType && okKant && okAttr;
  });
}

function renderPins(rows){
  cluster.clearLayers();
  rows.forEach(r=>{
    const m = L.marker([r.latitude, r.longitude]);
    m.bindPopup(pinPopup(r));
    cluster.addLayer(m);
  });
  if(rows.length){
    const group = L.featureGroup(rows.map(r=>L.marker([r.latitude, r.longitude])));
    map.fitBounds(group.getBounds().pad(0.2));
  }
  $('#count').textContent = `${rows.length} pins`;
}

function activeFiltersLabel(){
  const parts=[];
  if(state.muni.length) parts.push(`gemeente ${state.muni.length}`);
  if(state.city.length) parts.push(`plaats ${state.city.length}`);
  if(state.sport.length) parts.push(`sport ${state.sport.length}`);
  if(state.type.length) parts.push(`type ${state.type.length}`);
  if(state.kantine.length) parts.push(`kantine ${state.kantine.join('/')}`);
  if(state.attr.length) parts.push(`attribuut ${state.attr.length}`);
  return parts.length?parts.join(' · '):'geen filters';
}

async function refresh(){
  const rows = filterOrgs();
  renderPins(rows);
  $('#meta').textContent = activeFiltersLabel();
}

(async function start(){
  initMap();
  await loadData();
  await buildFilters();
  await refresh();
})();
