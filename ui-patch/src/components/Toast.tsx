
import React from 'react'
export function Toast({ message }: { message: string }) {
  if (!message) return null
  return <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg">{message}</div>
}
