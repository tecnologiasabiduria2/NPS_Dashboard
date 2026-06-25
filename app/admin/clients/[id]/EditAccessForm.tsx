'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  currentDate: string
  ghlContactId: string
  status: string
}

export default function EditAccessForm({ userId, currentDate, ghlContactId, status }: Props) {
  const router = useRouter()
  const [date, setDate] = useState(currentDate)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setLoading(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/ghl/update-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, access_until: date, ghl_contact_id: ghlContactId }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error ?? 'Error al guardar. Intenta de nuevo.')
    } else {
      setSaved(true)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Estado actual</p>
          <span className={status === 'active' ? 'badge-active' : status === 'inactive' ? 'badge-inactive' : 'badge-pending'}>
            {status === 'active' ? 'Activo' : status === 'inactive' ? 'Inactivo' : 'Pendiente'}
          </span>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">ID en GHL</p>
          <p className="text-xs text-zinc-400 font-mono">{ghlContactId || '—'}</p>
        </div>
      </div>
      <div>
        <label className="label">Acceso hasta</label>
        <div className="flex gap-3">
          <input
            type="date"
            className="input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <button onClick={handleSave} disabled={loading} className="btn-primary whitespace-nowrap">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        {saved && <p className="text-green-400 text-xs mt-2">✓ Guardado y sincronizado con GHL</p>}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    </div>
  )
}
