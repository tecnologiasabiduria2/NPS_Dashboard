'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'
import { coLocalToISO } from '@/lib/format'
import { toast } from '@/lib/toast'
import DateField from '@/components/DateField'

// Suma horas a un valor de <input datetime-local> manteniendo la hora de pared.
function addHoursLocal(localStr: string, hours: number): string {
  if (!localStr) return ''
  const d = new Date(localStr)
  if (isNaN(d.getTime())) return ''
  d.setHours(d.getHours() + hours)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Agenda una 1:1 con link — mismo motor que las sesiones grupales
// (audience='individual'), así el NPS post-sesión se dispara solo, igual que
// en las grupales (calibración 2026-07-07). El cs_id (mentor responsable) lo
// resuelve el servidor a partir del hiperfoco actual del cliente.
export default function Schedule1a1Form({ userId, productId }: { userId: string; productId: string | null }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [zoomUrl, setZoomUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setStart(value: string) {
    setStartsAt(value)
    setEndsAt(value ? addHoursLocal(value, 1) : '')
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!startsAt || !endsAt) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audience: 'individual',
        client_user_id: userId,
        product_id: productId ?? '',
        title: title.trim() || 'Sesión 1:1',
        tipo: '1_a_1',
        starts_at: coLocalToISO(startsAt),
        ends_at: coLocalToISO(endsAt),
        zoom_url: zoomUrl,
        is_published: true,
      }),
    })

    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      const msg = data.error ?? 'No se pudo agendar la sesión'
      setError(msg); toast.error(msg); return
    }
    toast.success('1:1 agendada — el cliente ya la ve en su calendario.')
    setTitle(''); setStartsAt(''); setEndsAt(''); setZoomUrl('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3 mb-5 pb-5 border-b border-surface-800">
      <input
        type="text"
        className="input"
        placeholder="Título (opcional, ej. Sesión 1:1 — Finanzas julio)"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Inicio * <span className="text-cream-muted font-normal">(hora Colombia)</span></label>
          <DateField mode="datetime" required value={startsAt} onChange={setStart} />
        </div>
        <div>
          <label className="label">Fin * <span className="text-cream-muted font-normal">(hora Colombia)</span></label>
          <DateField mode="datetime" required value={endsAt} onChange={v => { setEndsAt(v); setError('') }} />
        </div>
      </div>
      <input
        type="url"
        className="input"
        placeholder="Link de la reunión (opcional — se puede asignar después)"
        value={zoomUrl}
        onChange={e => { setZoomUrl(e.target.value); setError('') }}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={loading || !startsAt || !endsAt} className="btn-primary">
          <CalendarPlus size={14} /> {loading ? 'Agendando...' : 'Agendar 1:1'}
        </button>
      </div>
    </form>
  )
}
