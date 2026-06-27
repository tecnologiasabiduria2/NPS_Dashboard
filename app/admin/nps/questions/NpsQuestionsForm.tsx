'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { NpsCopy } from '@/lib/nps'
import type { NpsTrigger } from '@/types'

interface Props {
  trigger: NpsTrigger
  label: string
  initial: NpsCopy
}

export default function NpsQuestionsForm({ trigger, label, initial }: Props) {
  const router = useRouter()
  const [eyebrow, setEyebrow] = useState(initial.eyebrow)
  const [title, setTitle] = useState(initial.title)
  const [question, setQuestion] = useState(initial.question)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty =
    eyebrow !== initial.eyebrow || title !== initial.title || question !== initial.question

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!eyebrow.trim() || !title.trim() || !question.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }
    setLoading(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/admin/nps-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger, eyebrow, title, question }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Error al guardar.')
      setLoading(false)
      return
    }

    setLoading(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-sm font-semibold text-cream">{label}</h2>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">Línea superior (eyebrow)</label>
        <input className="input" value={eyebrow} onChange={e => setEyebrow(e.target.value)} />
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">Título</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        {trigger === 'post_sesion' && (
          <p className="text-[11px] text-zinc-600 mt-1">
            Usa <code className="text-accent">{'{sesion}'}</code> donde quieras el nombre de la sesión.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">Pregunta</label>
        <textarea
          className="input min-h-20 resize-y"
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-green-400">Guardado ✓</span>}
        <button type="submit" disabled={loading || !dirty} className="btn-primary disabled:opacity-40">
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
