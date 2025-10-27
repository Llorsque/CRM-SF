
import React from 'react'
import Clubs from './pages/Clubs'
export default function App() {
  return (
    <div className="min-h-screen">
      <header className="brand-gradient text-white p-6">
        <h1 className="text-2xl font-bold">Github CRM — Clubs</h1>
        <p className="opacity-90">GO UI patch: formulieren + live refresh na opslaan</p>
      </header>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <Clubs />
      </main>
    </div>
  )
}
