
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
type Metrics = { id?: string; club_id: string; year: number; members?: number | null; volunteers?: number | null }
export function MetricsForm({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const [form, setForm] = useState<Metrics>({ club_id: clubId, year: new Date().getFullYear(), members: null, volunteers: null })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  async function save() {
    setBusy(true); setMsg('')
    const payload = { ...form, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
    const res = await supabase.from('member_stats').insert([payload])
    if (res.error) setMsg(res.error.message); else { setMsg('Opgeslagen'); onSaved?.() }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block"><div className="text-xs font-medium text-slate-600">Jaar</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={form.year} onChange={e=>setForm({...form, year: Number(e.target.value)})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Leden</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={form.members ?? ''} onChange={e=>setForm({...form, members: Number(e.target.value)})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Vrijwilligers</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={form.volunteers ?? ''} onChange={e=>setForm({...form, volunteers: Number(e.target.value)})} />
        </label>
      </div>
      <button disabled={busy} onClick={save} className="px-4 py-2 rounded-2xl bg-slate-900 text-white">{busy ? 'Bezig…' : 'Opslaan'}</button>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </div>
  )
}
