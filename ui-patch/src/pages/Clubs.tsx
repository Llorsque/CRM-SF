
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DataTable } from '../components/DataTable'
import { ClubForm, type Club } from '../components/ClubForm'
import { ContactForm } from '../components/ContactForm'
import { MetricsForm } from '../components/MetricsForm'
import { FeesForm } from '../components/FeesForm'

type ClubRow = Club & { id: string }

export default function Clubs() {
  const [rows, setRows] = useState<ClubRow[]>([])
  const [selected, setSelected] = useState<ClubRow | null>(null)
  const [filter, setFilter] = useState('')

  async function load() {
    const res = await supabase.from('clubs').select('*').order('updated_at', { ascending: false })
    if (!res.error && res.data) setRows(res.data as ClubRow[])
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    return rows.filter(r => [r.name, r.sport, r.municipality, r.city].some(v => (v ?? '').toLowerCase().includes(q)))
  }, [rows, filter])

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-3">
        <div className="flex items-center gap-3">
          <input placeholder="Zoek op naam, sport, gemeente, plaats…" className="flex-1 border rounded-2xl px-4 py-2" value={filter} onChange={e=>setFilter(e.target.value)} />
          <button className="px-3 py-2 rounded-2xl border" onClick={load}>Vernieuwen</button>
        </div>
        <DataTable data={filtered} onRowClick={setSelected} columns={[
          { key: 'name', header: 'Naam' },
          { key: 'sport', header: 'Sport' },
          { key: 'municipality', header: 'Gemeente' },
          { key: 'city', header: 'Plaats' },
        ]} />
      </div>
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-white border shadow-sm">
          <div className="font-semibold mb-2">{selected ? 'Bewerken' : 'Nieuwe vereniging'}</div>
          <ClubForm club={selected ?? undefined} onSaved={() => { setSelected(null); load() }} />
        </div>
        {selected && (
          <div className="p-4 rounded-2xl bg-white border shadow-sm space-y-4">
            <div>
              <div className="font-semibold mb-2">Contactpersoon toevoegen</div>
              <ContactForm clubId={selected.id} onSaved={load} />
            </div>
            <div>
              <div className="font-semibold mb-2">Leden & Vrijwilligers (per jaar)</div>
              <MetricsForm clubId={selected.id} onSaved={load} />
            </div>
            <div>
              <div className="font-semibold mb-2">Contributies (per jaar)</div>
              <FeesForm clubId={selected.id} onSaved={load} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
