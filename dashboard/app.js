
// Dashboard logic wired to Supabase schema from CRM
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../crm/config.js';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{persistSession:false} });

// Utilities
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

const state = {
  sport:'', muni:'', type:'', kind:'', status:'', attr:'',
  post:'', from:'', to:''
};

function setTile(key, value, sub){
  const t = $(`[data-tile="${key}"]`);
  if(!t) return;
  t.querySelector('.big').textContent = value ?? '–';
  const subEl = t.querySelector('[data-sub]');
  if(subEl && sub!==undefined) subEl.textContent = sub;
}

function fmtDate(d){
  if(!d) return '–';
  const dt = new Date(d);
  const p = (n)=>String(n).padStart(2,'0');
  return `${p(dt.getDate())}-${p(dt.getMonth()+1)}-${dt.getFullYear()}`;
}

function dayDelta(days){
  const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString();
}

function activeFiltersLabel(){
  const labels=[];
  for(const [k,v] of Object.entries(state)){
    if(v) labels.push(`${k}=${v}`);
  }
  return labels.length?labels.join(' · '):'geen';
}

// ---------- Filters bootstrapping ----------
async function loadOptions(){
  // Distinct sport & gemeente from organizations
  const { data: sps } = await sb.from('organizations').select('sport').not('sport','is',null);
  const { data: mus } = await sb.from('organizations').select('municipality').not('municipality','is',null);
  const unique = (arr)=>Array.from(new Set(arr.map(x=>Object.values(x)[0]).filter(Boolean))).sort();

  const sports = unique(sps||[]);
  const munis = unique(mus||[]);
  const f_sport = $('#f_sport'), f_muni = $('#f_muni');
  sports.forEach(v=>f_sport.append(new Option(v,v)));
  munis.forEach(v=>f_muni.append(new Option(v,v)));

  // Default periode = laatste 90 dagen
  const to = new Date(); const from = new Date(); from.setDate(from.getDate()-90);
  $('#f_from').value = from.toISOString().slice(0,10);
  $('#f_to').value = to.toISOString().slice(0,10);
  state.from = $('#f_from').value; state.to = $('#f_to').value;
}

['f_sport','f_muni','f_type','f_kind','f_status','f_attr','f_post','f_from','f_to'].forEach(id=>{
  document.addEventListener('change', (e)=>{
    if(e.target && e.target.id===id){
      const key = id.replace('f_','');
      state[key] = e.target.value;
      refresh();
    }
  });
});

// ---------- Query helpers ----------
async function resolveOrgIds(){
  // Apply organization-level filters to get list of id_code to use elsewhere
  let q = sb.from('organizations').select('id_code, sport, municipality, type, postal_code');
  if(state.sport) q = q.eq('sport', state.sport);
  if(state.muni) q = q.eq('municipality', state.muni);
  if(state.type) q = q.eq('type', state.type);
  if(state.post) q = q.ilike('postal_code', `${state.post}%`);

  // If attr filter set, intersect with v_current_attributes(value=1)
  if(state.attr){
    const { data: attrClubs } = await sb.from('v_current_attributes')
      .select('org_id').eq('attr_key', state.attr).eq('value', 1);
    const attrIds = new Set((attrClubs||[]).map(r=>r.org_id));
    const { data: orgs } = await q;
    const ids = (orgs||[]).map(r=>r.id_code).filter(id=>attrIds.has(id));
    return ids;
  }else{
    const { data: orgs } = await q;
    return (orgs||[]).map(r=>r.id_code);
  }
}

function inPeriod(col){
  let from = state.from ? `${state.from}T00:00:00Z` : null;
  let to   = state.to   ? `${state.to}T23:59:59Z` : null;
  return { from, to };
}

// ---------- Metrics ----------
async function compute(){
  const orgIds = await resolveOrgIds();
  const orgIn = orgIds.length ? orgIds : ['__none__']; // avoid empty .in()

  // 1) Interactions total in period (+ 7d submetric)
  const { from, to } = inPeriod('occurred_at');
  let qi = sb.from('club_interactions').select('id, org_id, occurred_at', { count:'exact', head:false }).in('org_id', orgIn);
  if(state.kind) qi = qi.eq('kind', state.kind);
  if(from) qi = qi.gte('occurred_at', from);
  if(to) qi = qi.lte('occurred_at', to);
  const { data: ix, count: ixCount } = await qi;

  setTile('interactions_total', ixCount ?? (ix?.length||0));

  // last 7 days
  let q7 = sb.from('club_interactions').select('id', { count:'exact', head:false }).in('org_id', orgIn);
  q7 = q7.gte('occurred_at', dayDelta(-7)).lte('occurred_at', new Date().toISOString());
  if(state.kind) q7 = q7.eq('kind', state.kind);
  const { count: weekCount } = await q7;
  setTile('week_new_interactions', weekCount ?? 0);

  // last activity date
  const last = (ix||[]).sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at))[0];
  setTile('last_activity', last?fmtDate(last.occurred_at):'–');

  // 2) Clubs total (filtered) & active clubs
  setTile('clubs_total', orgIds.length);
  const activeClubs = new Set((ix||[]).map(r=>r.org_id));
  setTile('active_clubs', activeClubs.size);

  // 3) Avg interactions per club (period)
  const avg = orgIds.length ? ((ix?.length||0) / orgIds.length) : 0;
  setTile('avg_interactions_per_club', (Math.round(avg*10)/10).toLocaleString('nl-NL'));

  // 4) Trajecten metrics
  const fdateFrom = state.from ? state.from : null;
  const fdateTo   = state.to ? state.to : null;

  // started in period
  let qs = sb.from('trajecten').select('id', {count:'exact', head:false}).in('org_id', orgIn);
  if(fdateFrom) qs = qs.gte('start_datum', fdateFrom);
  if(fdateTo)   qs = qs.lte('start_datum', fdateTo);
  if(state.status) qs = qs.eq('status', state.status);
  const { count: tStarted } = await qs;
  setTile('trajecten_started', tStarted ?? 0);

  // closed in period
  let qc = sb.from('trajecten').select('id', {count:'exact', head:false}).in('org_id', orgIn);
  if(fdateFrom) qc = qc.gte('eind_datum', fdateFrom);
  if(fdateTo)   qc = qc.lte('eind_datum', fdateTo);
  if(state.status) qc = qc.eq('status', state.status);
  const { count: tClosed } = await qc;
  setTile('trajecten_closed', tClosed ?? 0);

  // open (status != afgerond), filtered by org
  let qo = sb.from('trajecten').select('id', {count:'exact', head:false}).in('org_id', orgIn).neq('status','afgerond');
  if(state.status) qo = qo.eq('status', state.status);
  const { count: tOpen } = await qo;
  setTile('trajecten_open', tOpen ?? 0);

  // 5) Attributes snapshot (at 'to' date, else today)
  const snapDate = state.to || new Date().toISOString().slice(0,10);
  async function attrCount(key){
    let qa = sb.from('organization_attribute_facts').select('org_id', {count:'exact', head:false});
    qa = qa.eq('attr_key', key).eq('value', 1);
    qa = qa.lte('valid_from', snapDate).or(`valid_to.is.null,valid_to.gte.${snapDate}`);
    const { data: rows } = await qa;
    // Filter org-level constraints
    const ids = new Set((rows||[]).map(r=>r.org_id));
    return orgIds.filter(id=>ids.has(id)).length;
  }
  setTile('attr_nieuwsbrief', await attrCount('nieuwsbrief_ontvangen'));
  setTile('attr_sociaal', await attrCount('sociaal_veilig'));

  // 6) Top postcode (mode) among filtered orgs
  if(orgIds.length){
    const { data: orgs } = await sb.from('organizations').select('postal_code,id_code').in('id_code', orgIds);
    const freq = new Map();
    (orgs||[]).forEach(o=>{
      const pc = (o.postal_code||'').toString().slice(0,4);
      if(!pc) return;
      freq.set(pc, (freq.get(pc)||0)+1);
    });
    const top = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1])[0];
    setTile('post_top', top?top[0]:'–');
  }else{
    setTile('post_top','–');
  }

  // UI meta
  $('#ql').textContent = 'Filters actief: ' + activeFiltersLabel();
  $('#ts').textContent = 'Laatst geüpdatet: ' + fmtDate(new Date());
}

// ---------- Refresh orchestrator ----------
async function refresh(){
  // accent tile subtitle
  const { data: week } = await sb.from('club_interactions')
    .select('id', { count:'exact', head:false })
    .gte('occurred_at', dayDelta(-7)).lte('occurred_at', new Date().toISOString());
  const sub = `${(week?.length||0)} vonden plaats in de afgelopen week`;
  setTile('interactions_total', undefined, sub);

  await compute().catch(err=>{
    console.error(err);
    alert('Fout bij laden dashboard: ' + (err.message||err));
  });
}

// ---------- Init ----------
await loadOptions();
await refresh();
