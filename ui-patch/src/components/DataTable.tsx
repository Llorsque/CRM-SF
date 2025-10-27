
import React from 'react'
type Column<T> = { key: keyof T; header: string; render?: (row: T) => React.ReactNode }
export function DataTable<T extends { id: string | number }>({
  data, columns, onRowClick
}: { data: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl shadow-sm border bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>{columns.map(c => <th key={String(c.key)} className="px-4 py-2 text-left text-sm font-semibold text-slate-700">{c.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {data.map(row => (
            <tr key={row.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onRowClick?.(row)}>
              {columns.map(c => <td key={String(c.key)} className="px-4 py-2 text-sm text-slate-800">{c.render ? c.render(row) : String(row[c.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
