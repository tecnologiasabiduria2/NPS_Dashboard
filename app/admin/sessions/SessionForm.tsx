'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CheckCircle2, Trash2 } from 'lucide-react'

interface Session {
  id: string
  title: string
  starts_at: string
  ends_at: string
  zoom_url: string
  is_published: boolean
}

interface Props {
  products: { id: string; label: string }[]
  sessionsByProduct: Record<string, Session[]>
}

// ISO (timestamptz) -> valor para <input type="datetime-local"> en hora local
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY = { sessionId: '', title: '', starts_at: '', ends_at: '', zoom_url: '', is_published: true }

export default function SessionForm({ products, sessionsByProduct }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState('')
  const [f, setF] = useState({ ...EMPTY })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const productSessions = useMemo(
    () => (productId ? sessionsByProduct[productId] ?? [] : []),
    [productId, sessionsByProduct]
  )

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF(prev => ({ ...prev, [key]: value }))
    setSuccess(''); setError('')
  }

  function changeProduct(id: string) {
    setProductId(id); setF({ ...EMPTY }); setSuccess(''); setError('')
  }

  function pickSession(sessionId: string) {
    if (!sessionId) { setF({ ...EMPTY }); return }
    const s = productSessions.find(x => x.id === sessionId)
    if (!s) return
    setF({
      sessionId: s.id,
      title: s.title,
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
      zoom_url: s.zoom_url,
      is_published: s.is_published,
    })
    setSuccess(''); setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: f.sessionId || undefined,
        product_id: productId,
        title: f.title,
        // datetime-local (hora local) -> ISO UTC
        starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : '',
        ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : '',
        zoom_url: f.zoom_url,
        is_published: f.is_published,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo guardar la sesión'); return }
    setSuccess(f.sessionId ? 'Sesión actualizada.' : 'Sesión creada.')
    setF({ ...EMPTY })
    router.refresh()
  }

  async function remove() {
    if (!f.sessionId || !confirm('¿Eliminar esta sesión?')) return
    setLoading(true); setError(''); setSuccess('')
    const res = await fetch(`/api/admin/sessions?id=${f.sessionId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'No se pudo eliminar'); return }
    setSuccess('Sesión eliminada.')
    setF({ ...EMPTY })
    router.refresh()
  }

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-1">
        <CalendarPlus size={18} className="text-brand-400" />
        <h2 className="text-lg font-semibold text-cream">Programar / editar sesión en vivo</h2>
      </div>
      <p className="text-sm text-cream-muted mb-5">
        Define el horario y el link de Zoom por producto. De aquí en adelante solo cambias estos datos.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Producto *</label>
          <select className="select" value={productId} onChange={e => changeProduct(e.target.value)} required>
            <option value="">— Selecciona un producto —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        {productId && (
          <div>
            <label className="label">Sesión</label>
            <select className="select" value={f.sessionId} onChange={e => pickSession(e.target.value)}>
              <option value="">— Nueva sesión —</option>
              {productSessions.map(s => (
                <option key={s.id} value={s.id}>
                  {new Date(s.starts_at).toLocaleString('es-CO')} · {s.title}
                </option>
              ))}
            </select>
            {f.sessionId && <p className="text-xs text-accent mt-1.5">Editando una sesión existente</p>}
          </div>
        )}

        <div>
          <label className="label">Título</label>
          <input type="text" className="input" placeholder="Sesión en vivo"
            value={f.title} onChange={e => set('title', e.target.value)} disabled={!productId} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Inicio *</label>
            <input type="datetime-local" className="input"
              value={f.starts_at} onChange={e => set('starts_at', e.target.value)} disabled={!productId} required />
          </div>
          <div>
            <label className="label">Fin *</label>
            <input type="datetime-local" className="input"
              value={f.ends_at} onChange={e => set('ends_at', e.target.value)} disabled={!productId} required />
          </div>
        </div>

        <div>
          <label className="label">Link de Zoom *</label>
          <input type="url" className="input" placeholder="https://zoom.us/j/..."
            value={f.zoom_url} onChange={e => set('zoom_url', e.target.value)} disabled={!productId} required />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-brand-600"
            checked={f.is_published} onChange={e => set('is_published', e.target.checked)} disabled={!productId} />
          <span className="text-sm text-cream-dim">Publicada (visible para el cliente)</span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <p className="text-emerald-300 text-sm">{success}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || !productId} className="btn-primary flex-1 justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Guardando…' : f.sessionId ? 'Guardar cambios' : 'Crear sesión'}
          </button>
          {f.sessionId && (
            <button type="button" onClick={remove} disabled={loading} className="btn-danger flex items-center gap-2">
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
