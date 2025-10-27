
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
export type Club = {
  id?: string; name: string; sport: string; municipality: string;
  federation?: string | null; street?: string | null; postcode?: string | null;
  city?: string | null; has_canteen?: boolean | null
}
export function ClubForm({ club, onSaved }: { club?: Club; onSaved?: (id: string) => void }) {
  const [form, setForm] = useState<Club>(club ?? { name: '', sport: '', municipality: '', federation: '', street: '', postcode: '', city: '', has_canteen: null })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string>('')
  async function save() {
    setBusy(true); setMsg('')
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (!form.name || !form.sport || !form.municipality) { setMsg('Vul minimaal naam, sport en gemeente in.'); setBusy(false); return }
    let result
    if (club?.id) { result = await supabase.from('clubs').update(payload).eq('id', club.id).select('id').single() }
    else { result = await supabase.from('clubs').insert([{ ...payload, created_at: new Date().toISOString() }]).select('id').single() }
    if (result.error) setMsg(result.error.message); else { setMsg('Opgeslagen'); onSaved?.(result.data.id) }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block"><div className="text-xs font-medium text-slate-600">Naam</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Sport</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.sport} onChange={e=>setForm({...form, sport: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Gemeente</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.municipality} onChange={e=>setForm({...form, municipality: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Bond</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.federation ?? ''} onChange={e=>setForm({...form, federation: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Straat + Huisnr</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.street ?? ''} onChange={e=>setForm({...form, street: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Postcode</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.postcode ?? ''} onChange={e=>setForm({...form, postcode: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Plaats</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.city ?? ''} onChange={e=>setForm({...form, city: e.target.value})} />
        </label>
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={!!form.has_canteen} onChange={e=>setForm({...form, has_canteen: e.target.checked})} />
          <span>Eigen kantine</span>
        </label>
      </div>
      <button disabled={busy} onClick={save} className="px-4 py-2 rounded-2xl bg-slate-900 text-white">{busy ? 'Bezig…' : 'Opslaan'}</button>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </div>
  )
}
