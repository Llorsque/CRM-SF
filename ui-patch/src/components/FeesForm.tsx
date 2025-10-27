
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
type Fee = { id?: string; club_id: string; year: number; description?: string | null; amount_cents?: number | null }
export function FeesForm({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const [form, setForm] = useState<Fee>({ club_id: clubId, year: new Date().getFullYear(), description: '', amount_cents: null })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  async function save() {
    setBusy(true); setMsg('')
    const payload = { ...form, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
    const res = await supabase.from('fees').insert([payload])
    if (res.error) setMsg(res.error.message); else { setMsg('Opgeslagen'); onSaved?.() }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block"><div className="text-xs font-medium text-slate-600">Jaar</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={form.year} onChange={e=>setForm({...form, year: Number(e.target.value)})} />
        </label>
        <label className="block md:col-span-2"><div className="text-xs font-medium text-slate-600">Omschrijving (bijv. senioren contributie)</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.description ?? ''} onChange={e=>setForm({...form, description: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Bedrag (in eurocenten)</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={form.amount_cents ?? ''} onChange={e=>setForm({...form, amount_cents: Number(e.target.value)})} />
        </label>
      </div>
      <button disabled={busy} onClick={save} className="px-4 py-2 rounded-2xl bg-slate-900 text-white">{busy ? 'Bezig…' : 'Opslaan'}</button>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </div>
  )
}
