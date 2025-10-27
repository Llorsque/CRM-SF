
window.CRMUI=(function(){
  let sb=null, cfg={ getOrgId:()=>'',
    supabaseUrl:'', anonKey:''
  };

  function h(t,a={},c=[]){const e=document.createElement(t);
    for(const[k,v]of Object.entries(a)){
      if(k==='class') e.className=v;
      else if(k.startsWith('on')&&typeof v==='function') e.addEventListener(k.slice(2),v);
      else e.setAttribute(k,v)
    }
    for(const n of(Array.isArray(c)?c:[c])){ if(n==null) continue; e.appendChild(typeof n==='string'?document.createTextNode(n):n) }
    return e
  }
  function fmt(ts=new Date()){const p=n=>String(n).padStart(2,'0'); return ts.getFullYear()+"-"+p(ts.getMonth()+1)+"-"+p(ts.getDate())+"T"+p(ts.getHours())+":"+p(ts.getMinutes())}
  function toast(msg){ let t=document.getElementById('crm-toast'); if(!t){ t=h('div',{id:'crm-toast',style:'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 14px;border-radius:10px;zIndex:10000'}); document.body.appendChild(t) } t.textContent=msg; t.style.display='block'; clearTimeout(toast._t); toast._t=setTimeout(()=>t.style.display='none',2500) }
  function ok(err,okMsg){ if(err){ throw err } toast(okMsg||'Opgeslagen') }
  function val(id){ const el=document.getElementById(id); return el?el.value:'' }
  function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=v }

  function modal(){
    const root=h('div',{class:'crm-modal',id:'crm-modal'}),
          card=h('div',{class:'crm-card'}),
          head=h('div',{class:'crm-h'},[h('div',{},[h('strong',{},'Toevoegen / Bewerken')]), h('button',{class:'btn ghost', onClick:()=>root.style.display='none'},'Sluiten')]),
          body=h('div',{class:'crm-body'}),
          tabs=h('div',{class:'crm-tabs'}),
          content=h('div',{id:'crm-content'});

    const tabDefs=[
      {key:'interactie', label:'Interactie'},
      {key:'traject', label:'Traject'},
      {key:'attribuut', label:'Attribuut'},
      {key:'klant', label:'Klantgegevens'}
    ];
    let active='interactie';

    function renderTabs(){
      tabs.innerHTML='';
      for(const t of tabDefs){
        const b=h('button',{class:'crm-tab'+(t.key===active?' active':''), onClick:()=>{active=t.key; renderTabs(); renderContent()}}, t.label);
        tabs.appendChild(b)
      }
    }
    function renderContent(){
      content.innerHTML='';
      if(active==='interactie') content.appendChild(viewInteractie());
      if(active==='traject') content.appendChild(viewTraject());
      if(active==='attribuut') content.appendChild(viewAttribuut());
      if(active==='klant') content.appendChild(viewKlant());
    }

    body.appendChild(tabs); body.appendChild(content);
    card.appendChild(head); card.appendChild(body); root.appendChild(card);
    document.body.appendChild(root);
    renderTabs(); renderContent();
    return { open:()=>root.style.display='flex' }
  }

  function currentOrgId(){
    return (typeof cfg.getOrgId==='function' && cfg.getOrgId()) || window.activeClubId || ''
  }

  function guardReady(){
    if(!cfg.supabaseUrl || !cfg.anonKey){
      console.warn('Supabase keys missen. config.js wordt gebruikt om ze te zetten.');
      return false
    }
    if(!currentOrgId()){
      toast('⚠️ Geen vereniging geselecteerd'); return false
    }
    return true
  }

  // Views
  function viewInteractie(){
    const wrap=h('div',{},[
      h('div',{class:'crm-grid'},[
        field('Datum/tijd', h('input',{type:'datetime-local', id:'ci_time', value:fmt()})),
        field('Type', select('ci_kind',['meeting','call','email','bezoek','actie','overig'])),
        field('Onderwerp', h('input',{id:'ci_subject', placeholder:'bv. Kennismaking'})),
        field('Kanaal', select('ci_channel',['on-site','online','phone','mail'])),
        field('Notitie', h('textarea',{id:'ci_notes', rows:'4', placeholder:'Korte notitie...'}), true)
      ]),
      actions(async ()=>{
        const orgId=currentOrgId(); const occurred_at=new Date(val('ci_time')||new Date());
        const { error } = await sb.from('club_interactions').insert({
          org_id: orgId, occurred_at: occurred_at.toISOString(),
          kind: val('ci_kind'), subject: val('ci_subject')||null,
          notes: (document.getElementById('ci_notes').value||'')||null,
          channel: val('ci_channel')||null
        });
        ok(error,'Interactie opgeslagen.')
      })
    ]);
    return wrap
  }

  function viewTraject(){
    const wrap=h('div',{},[
      h('div',{class:'crm-grid'},[
        field('Titel', h('input',{id:'tr_title', placeholder:'bv. Vrijwilligersbeleid'})),
        field('Status', select('tr_status',['open','lopend','on-hold','afgerond','geannuleerd'])),
        field('Startdatum', h('input',{type:'date', id:'tr_start', value:(new Date()).toISOString().slice(0,10)})),
        field('Notitie (event)', h('input',{id:'tse_note', placeholder:'optioneel'}))
      ]),
      actions(async ()=>{
        const orgId=currentOrgId();
        const ins=await sb.from('trajecten').insert({
          org_id: orgId, titel: val('tr_title'), status: val('tr_status'),
          start_datum: document.getElementById('tr_start').value
        }).select('id,status').single();
        if(ins.error) throw ins.error;
        await sb.from('traject_status_events').insert({
          traject_id: ins.data.id, old_status: null,
          new_status: ins.data.status, note: val('tse_note')||null
        });
        ok(null,'Traject opgeslagen.')
      })
    ]);
    return wrap
  }

  function viewAttribuut(){
    const wrap=h('div',{},[
      h('div',{class:'crm-grid'},[
        field('Attribuut', select('at_key',['nieuwsbrief_ontvangen','sociaal_veilig','privacyverklaring','vwc_aanwezig'])),
        field('Waarde', select('at_val',[['1','Ja'],['0','Nee']])),
        field('Ingangsdatum', h('input',{type:'date', id:'at_from', value:(new Date()).toISOString().slice(0,10)}))
      ]),
      actions(async ()=>{
        const orgId=currentOrgId();
        const { error } = await sb.from('organization_attribute_facts').insert({
          org_id: orgId, attr_key: val('at_key'),
          value: parseInt(val('at_val'),10),
          valid_from: document.getElementById('at_from').value
        });
        ok(error,'Attribuut vastgelegd.')
      })
    ]);
    return wrap
  }

  function viewKlant(){
    const wrap=h('div',{},[
      h('div',{class:'crm-grid'},[
        field('Naam', h('input',{id:'org_name'})),
        field('Sport', h('input',{id:'org_sport'})),
        field('Gemeente', h('input',{id:'org_muni'})),
        field('Plaats', h('input',{id:'org_city'})),
        field('Postcode', h('input',{id:'org_post'})),
        field('Eigen kantine', select('org_kant',[['true','Ja'],['false','Nee']])),
      ]),
      actions(async ()=>{
        const orgId=currentOrgId();
        const upd=await sb.from('organizations').update({
          name: val('org_name')||null, sport: val('org_sport')||null,
          municipality: val('org_muni')||null, city: val('org_city')||null,
          postal_code: val('org_post')||null, has_canteen: val('org_kant')==='true',
          updated_by: 'crm-vanilla-ui'
        }).eq('id_code', orgId);
        ok(upd.error,'Gegevens bijgewerkt.')
      })
    ]);
    (async()=>{
      const orgId=currentOrgId(); if(!orgId) return;
      const { data } = await sb.from('organizations')
        .select('name,sport,municipality,city,postal_code,has_canteen')
        .eq('id_code', orgId).single();
      if(data){
        setVal('org_name', data.name||''); setVal('org_sport', data.sport||'');
        setVal('org_muni', data.municipality||''); setVal('org_city', data.city||'');
        setVal('org_post', data.postal_code||''); setVal('org_kant', String(!!data.has_canteen));
      }
    })();
    return wrap
  }

  // Helpers
  function field(label, control, full=false){ const r=h('div',{class:'crm-row'}); r.appendChild(h('label',{},label)); r.appendChild(control); if(full){ r.style.gridColumn='1 / -1' } return r }
  function select(id, items){ const s=h('select',{id}); for(const it of items){ if(Array.isArray(it)) s.appendChild(h('option',{value:it[0]},it[1])); else s.appendChild(h('option',{value:it},it)) } return s }
  function actions(onSave){ return h('div',{class:'crm-actions'},[ h('button',{class:'btn ghost',onClick:()=>document.getElementById('crm-modal').style.display='none'},'Annuleren'), h('button',{class:'btn',onClick:async()=>{ try{ if(!guardReady()) return; await onSave(); toast('✅ Opgeslagen') } catch(e){ console.error(e); toast('❌ Fout: '+(e.message||e)) } }},'Opslaan') ]) }

  function bindDetailsClicks(){
    document.addEventListener('click', (ev)=>{
      const t=ev.target; if(!(t instanceof Element)) return;
      const el = t.closest('[data-org]') || t.closest('[data-org-id]');
      if(el){ const id = el.getAttribute('data-org') || el.getAttribute('data-org-id'); if(id){ window.activeClubId = id; } }
    }, true);
  }

  return {
    init: ({supabaseUrl, anonKey, getOrgId}) => {
      cfg.supabaseUrl=supabaseUrl; cfg.anonKey=anonKey; cfg.getOrgId=getOrgId;
      if(!window.supabase){ console.error('Supabase JS niet gevonden'); return; }
      sb = window.supabase.createClient(supabaseUrl, anonKey, { auth:{ persistSession:false } });
      if(!document.getElementById('crm-modal')) modal();
      bindDetailsClicks();
    },
    attach: (btnSel) => {
      const btn=document.querySelector(btnSel);
      if(!btn) return;
      btn.addEventListener('click', ()=>{
        if(!guardReady()) return;
        const m=document.getElementById('crm-modal'); if(m) m.remove();
        const { open } = modal(); open();
      });
    },
    setActiveClub: (id) => { window.activeClubId = id; },
    open: () => {
      if(!guardReady()) return;
      const m=document.getElementById('crm-modal'); if(m) m.remove();
      const { open } = modal(); open();
    }
  }
})();
