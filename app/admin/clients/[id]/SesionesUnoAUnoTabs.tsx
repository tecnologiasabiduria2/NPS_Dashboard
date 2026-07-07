'use client'

import { useState } from 'react'
import Schedule1a1Form from './Schedule1a1Form'
import AddNoteForm from './AddNoteForm'

// Dos formas de dejar registrada una 1:1 (calibración 2026-07-07):
// "Agendar" (normal) = con link dentro de la plataforma, dispara NPS solo.
// "Registrar sesión pasada" (excepción) = cuando ya ocurrió por fuera
// (ej. el mentor creó su propio Meet) — sin NPS automático, solo nota.
export default function SesionesUnoAUnoTabs({ userId, productId }: { userId: string; productId: string | null }) {
  const [tab, setTab] = useState<'agendar' | 'registrar'>('agendar')

  return (
    <div>
      <div className="flex gap-1 mb-4 p-1 bg-surface-900 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('agendar')}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${tab === 'agendar' ? 'bg-brand-600/20 text-brand-300' : 'text-cream-muted hover:text-cream'}`}
        >
          Agendar
        </button>
        <button
          type="button"
          onClick={() => setTab('registrar')}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${tab === 'registrar' ? 'bg-brand-600/20 text-brand-300' : 'text-cream-muted hover:text-cream'}`}
        >
          Registrar sesión pasada
        </button>
      </div>
      {tab === 'agendar' ? (
        <Schedule1a1Form userId={userId} productId={productId} />
      ) : (
        <AddNoteForm userId={userId} />
      )}
    </div>
  )
}
