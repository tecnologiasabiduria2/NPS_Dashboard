'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

interface Props {
  id: 'claridad' | 'confianza' | 'reto'
  label: string
  initialTexto: string
}

export default function RetoPreguntaForm({ id, label, initialTexto }: Props) {
  const router = useRouter()
  const [texto, setTexto] = useState(initialTexto)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty = texto !== initialTexto

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) {
      setError('El texto es obligatorio.')
      return
    }
    setLoading(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/admin/reto-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, texto }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const msg = data.error ?? 'Error al guardar.'
      setError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }

    setLoading(false)
    setSaved(true)
    toast.success('Pregunta guardada.')
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="text-sm font-semibold text-cream">{label}</h2>

      <div>
        <label className="block text-xs text-cream-muted mb-1">Pregunta</label>
        <textarea
          className="input min-h-20 resize-y"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <p className="text-[11px] text-cream-muted mt-1">
          La escala de respuesta (Muy bajo … Muy alto) es fija, solo se edita el texto.
        </p>
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
