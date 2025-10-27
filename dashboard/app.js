
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../crm/config.js';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{persistSession:false} });

const $ = (s, r=document)=>r.querySelector(s);
function setTile(key, value, sub){
  const t = document.querySelector(`[data-tile="${key}"]`);
  if(!t) return;
  t.querySelector('.big').textContent = value ?? '–';
  const subEl = t.querySelector('[data-sub]');
  if(subEl && sub!==undefined) subEl.textContent = sub;
}
function fmtDate(d){ if(!d) return '–'; const dt=new Date(d); const p=n=>String(n).padStart(2,'0'); return `${p(dt.getDate())}-${p(dt.getMonth()+1)}-${dt.getFullYear()}`; }
function dayDelta(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString(); }

// Fetch ALL rows helpers (pagination)
async function fetchAll(table, select, whereCb){
  const pageSize = 1000;
  let from = 0, to = pageSize-1, rows=[], more=true;
  while(more){
    let q = sb.from(table).select(select, { head:false });
    if(whereCb) q = whereCb(q);
    q = q.range(from, to);
    const { data, error } = await q;
    if(error){ throw error; }
    rows = rows.concat(data||[]);
    more = (data||[]).length === pageSize;
    from += pageSize; to += pageSize;
  }
  return rows;
}

// Chunked .in() for large lists
function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size){ out.push(arr.slice(i,i+size)); } return out; }
async function countWithOrgIn(table, colDateFromTo, orgIds, extraCb){
  const parts = chunk(orgIds, 500);
  let total = 0;
  for(const ids of parts){
    let q = sb.from(table).select('id', { count:'exact', head:false }).in('org_id', ids);
    if(colDateFromTo?.from) q = q.gte(colDateFromTo.col || 'occurred_at', colDateFromTo.from);
    if(colDateFromTo?.to)   q = q.lte(colDateFromTo.col || 'occurred_at', colDateFromTo.to);
    if(extraCb) q = extraCb(q);
    const { data } = await q;
    total += (data||[]).length;
  }
  return total;
}

const state = {
  sport:[], muni:[], type:[], kind:[], status:[], attr:[], post:[], from:'', to:''
};

// Build multiselects
const ms = {};
function buildMS(id, options, onChange){
  const el = document.getElementById(id);
  ms[id] = window.MultiSelect.create(el, { options, onChange });
}
async function loadOptions(){
  // Load ALL orgs (id_code, sport, municipality, type, postal_code)
  const orgs = await fetchAll('organizations', 'id_code,sport,municipality,type,postal_code');
  window.__ALL_ORGS__ = orgs; // debug
  // Populate options
  const uniq = (arr)=>Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b),'nl'));
  buildMS('ms_sport',  uniq(orgs.map(o=>o.sport)), (v)=>{ state.sport=v; refresh(); });
  buildMS('ms_muni',   uniq(orgs.map(o=>o.municipality)), (v)=>{ state.muni=v; refresh(); });
  buildMS('ms_type',   uniq(orgs.map(o=>o.type)), (v)=>{ state.type=v; refresh(); });
  buildMS('ms_post',   uniq(orgs.map(o=>(o.postal_code||'').toString().slice(0,4)).filter(Boolean)), (v)=>{ state.post=v; refresh(); });
  buildMS('ms_kind',   ['meeting','call','email','bezoek','actie','overig'], (v)=>{ state.kind=v; refresh(); });
  buildMS('ms_status', ['open','lopend','on-hold','afgerond','geannuleerd'], (v)=>{ state.status=v; refresh(); });
  buildMS('ms_attr',   ['nieuwsbrief_ontvangen','sociaal_veilig'], (v)=>{ state.attr=v; refresh(); });

  // Default periode laatste 90 dagen
  const to = new Date(); const from = new Date(); from.setDate(from.getDate()-90);
  document.getElementById('f_from').value = from.toISOString().slice(0,10);
  document.getElementById('f_to').value   = to.toISOString().slice(0,10);
  state.from = document.getElementById('f_from').value;
  state.to   = document.getElementById('f_to').value;

  document.getElementById('f_from').addEventListener('change',(e)=>{ state.from=e.target.value; refresh(); });
  document.getElementById('f_to').addEventListener('change',(e)=>{ state.to=e.target.value; refresh(); });

  // Set total clubs tile baseline
  setTile('clubs_total', orgs.length);
  const subEl = document.querySelector('[data-tile="clubs_total"] .sub');
  if(subEl) subEl.textContent = `van totaal (${orgs.length})`;
}

function filterOrgIds(){
  const orgs = window.__ALL_ORGS__ || [];
  return orgs.filter(o=>{
    const pc = (o.postal_code||'').toString().slice(0,4);
    const okSport  = !state.sport.length  || state.sport.includes(o.sport);
    const okMuni   = !state.muni.length   || state.muni.includes(o.municipality);
    const okType   = !state.type.length   || state.type.includes(o.type);
    const okPost   = !state.post.length   || state.post.includes(pc);
    return okSport && okMuni && okType && okPost;
  }).map(o=>o.id_code);
}

function activeFiltersLabel(){
  const labels=[];
  ['sport','muni','type','kind','status','attr','post'].forEach(k=>{ if(state[k].length) labels.push(`${k}: ${state[k].length}`) });
  if(state.from||state.to) labels.push(`periode: ${state.from||'…'} t/m ${state.to||'…'}`);
  return labels.length?labels.join(' · '):'geen';
}

function periodBounds(colDefault='occurred_at'){
  let from = state.from ? `${state.from}T00:00:00Z` : null;
  let to   = state.to   ? `${state.to}T23:59:59Z` : null;
  return { from, to, col: colDefault };
}

async function compute(){
  const orgIds = filterOrgIds();
  const totalClubs = (window.__ALL_ORGS__||[]).length;
  setTile('clubs_total', orgIds.length, `van totaal (${totalClubs})`);

  // Interactions total
  const p = periodBounds('occurred_at');
  const interTotal = await countWithOrgIn('club_interactions', p, orgIds, (q)=>{
    if(state.kind.length) q = q.in('kind', state.kind);
    return q;
  });
  setTile('interactions_total', interTotal);

  // Week new interactions
  const week = await countWithOrgIn('club_interactions', {from:dayDelta(-7),to:new Date().toISOString(),col:'occurred_at'}, orgIds, (q)=>{
    if(state.kind.length) q = q.in('kind', state.kind);
    return q;
  });
  setTile('week_new_interactions', week);
  const sub = `${week} in de afgelopen week`;
  setTile('interactions_total', undefined, sub);

  // Last activity (we fetch minimal needed rows and compute max)
  let last='';
  if(orgIds.length){
    const parts = chunk(orgIds, 500);
    let maxTs = null;
    for(const ids of parts){
      let q = sb.from('club_interactions').select('occurred_at').in('org_id', ids);
      if(p.from) q = q.gte('occurred_at', p.from);
      if(p.to)   q = q.lte('occurred_at', p.to);
      const { data } = await q.order('occurred_at', {ascending:false}).limit(1);
      const ts = data?.[0]?.occurred_at;
      if(ts && (!maxTs || new Date(ts)>new Date(maxTs))) maxTs = ts;
    }
    last = maxTs ? fmtDate(maxTs) : '–';
  }
  setTile('last_activity', last);

  // Active clubs (≥1 interaction)
  const active = new Set();
  if(orgIds.length){
    const parts = chunk(orgIds, 500);
    for(const ids of parts){
      let q = sb.from('club_interactions').select('org_id').in('org_id', ids);
      if(p.from) q = q.gte('occurred_at', p.from);
      if(p.to)   q = q.lte('occurred_at', p.to);
      if(state.kind.length) q = q.in('kind', state.kind);
      const { data } = await q;
      (data||[]).forEach(r=>active.add(r.org_id));
    }
  }
  setTile('active_clubs', active.size);

  // Avg interactions per club
  const avg = orgIds.length ? (interTotal / orgIds.length) : 0;
  setTile('avg_interactions_per_club', (Math.round(avg*10)/10).toLocaleString('nl-NL'));

  // Trajecten
  const pf = { from: state.from || null, to: state.to || null, col: 'start_datum' };
  const started = await countWithOrgIn('trajecten', pf, orgIds, (q)=> state.status.length ? q.in('status', state.status) : q );
  setTile('trajecten_started', started);

  const pc = { from: state.from || null, to: state.to || null, col: 'eind_datum' };
  const closed = await countWithOrgIn('trajecten', pc, orgIds, (q)=> state.status.length ? q.in('status', state.status) : q );
  setTile('trajecten_closed', closed);

  const open = await countWithOrgIn('trajecten', null, orgIds, (q)=> (state.status.length ? q.in('status', state.status) : q).neq('status','afgerond') );
  setTile('trajecten_open', open);

  // Attributes snapshot
  async function attrCount(key){
    const snap = state.to || new Date().toISOString().slice(0,10);
    const rows = await fetchAll('organization_attribute_facts', 'org_id,valid_from,valid_to,value,attr_key',
      (q)=> q.eq('attr_key', key).eq('value',1).lte('valid_from', snap).or(`valid_to.is.null,valid_to.gte.${snap}`)
    );
    const ids = new Set(rows.map(r=>r.org_id));
    return orgIds.filter(id=>ids.has(id)).length;
  }
  setTile('attr_nieuwsbrief', await attrCount('nieuwsbrief_ontvangen'));
  setTile('attr_sociaal', await attrCount('sociaal_veilig'));

  // Top postcode
  let top='–';
  if(orgIds.length){
    const all = window.__ALL_ORGS__ || [];
    const map=new Map();
    all.filter(o=>orgIds.includes(o.id_code)).forEach(o=>{
      const pc=(o.postal_code||'').toString().slice(0,4);
      if(!pc) return; map.set(pc,(map.get(pc)||0)+1);
    });
    const arr=Array.from(map.entries()).sort((a,b)=>b[1]-a[1]);
    top = arr[0]?.[0] || '–';
  }
  setTile('post_top', top);

  // Footer
  document.getElementById('ql').textContent = 'Filters actief: ' + (function(){
    const parts=[];
    Object.entries({sport:state.sport,gemeente:state.muni,type:state.type,kind:state.kind,status:state.status,attribuut:state.attr,postcode:state.post}).forEach(([k,v])=>{
      if(v.length) parts.push(`${k} ${v.length}`);
    });
    if(state.from||state.to) parts.push(`periode ${state.from||'…'} t/m ${state.to||'…'}`);
    return parts.length?parts.join(' · '):'geen';
  })();
  document.getElementById('ts').textContent = 'Laatst geüpdatet: '+fmtDate(new Date());
}

async function refresh(){
  // quick subtitle week
  const week = await countWithOrgIn('club_interactions', {from:dayDelta(-7),to:new Date().toISOString(),col:'occurred_at'}, filterOrgIds(), (q)=> q );
  setTile('interactions_total', undefined, `${week} in de afgelopen week`);
  await compute().catch(err=>{
    console.error(err); alert('Fout bij laden dashboard: '+(err.message||err));
  });
}

// Init
await loadOptions();
await refresh();
