'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DateField from '@/components/DateField'

// Fecha de hoy en local (evita el desfase UTC de toISOString)
function localToday() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function AddNoteForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [date, setDate] = useState(localToday())
  const [fathom, setFathom] = useState('')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        content,
        session_date: date,
        fathom_share_id: fathom,
        summary,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al guardar la nota.')
      setLoading(false)
      return
    }

    setContent('')
    setDate(localToday())
    setFathom('')
    setSummary('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mb-5 pb-5 border-b border-surface-800">
      <DateField value={date} onChange={setDate} required className="w-auto" />
      <textarea
        className="input min-h-20 resize-y"
        placeholder="Notas de la sesión 1:1 (desafíos, acuerdos, próximos pasos)..."
        value={content}
        onChange={e => setContent(e.target.value)}
      />
      <input
        type="text"
        className="input"
        placeholder="Fathom share ID de la grabación 1:1 (opcional)"
        value={fathom}
        onChange={e => setFathom(e.target.value)}
      />
      <textarea
        className="input min-h-16 resize-y"
        placeholder="Summary de Fathom (opcional) — pega aquí el resumen de la sesión"
        value={summary}
        onChange={e => setSummary(e.target.value)}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={loading || !content.trim()} className="btn-primary">
          {loading ? 'Guardando...' : 'Agregar sesión 1:1'}
        </button>
      </div>
    </form>
  )
}
