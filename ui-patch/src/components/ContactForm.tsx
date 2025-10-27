
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
export type Contact = { id?: string; club_id: string; name: string; email?: string | null; phone?: string | null; role?: string | null }
export function ContactForm({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const [form, setForm] = useState<Contact>({ club_id: clubId, name: '', email: '', phone: '', role: '' })
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  async function save() {
    setBusy(true); setMsg('')
    const payload = { ...form, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }
    const res = await supabase.from('contacts').insert([payload])
    if (res.error) setMsg(res.error.message); else { setMsg('Opgeslagen'); onSaved?.() }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block"><div className="text-xs font-medium text-slate-600">Naam</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Rol/Functie</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.role ?? ''} onChange={e=>setForm({...form, role: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">E-mail</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.email ?? ''} onChange={e=>setForm({...form, email: e.target.value})} />
        </label>
        <label className="block"><div className="text-xs font-medium text-slate-600">Telefoon</div>
          <input className="w-full border rounded-xl px-3 py-2" value={form.phone ?? ''} onChange={e=>setForm({...form, phone: e.target.value})} />
        </label>
      </div>
      <button disabled={busy} onClick={save} className="px-4 py-2 rounded-2xl bg-slate-900 text-white">{busy ? 'Bezig…' : 'Opslaan'}</button>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </div>
  )
}
