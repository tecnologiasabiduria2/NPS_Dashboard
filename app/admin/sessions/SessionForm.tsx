'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { SESSION_TIPOS } from '@/lib/sessionTypes'
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

interface Session {
  id: string
  title: string
  tipo: string
  starts_at: string
  ends_at: string
  zoom_url: string
  is_published: boolean
  product_id: string
  descripcion?: string | null
  hiperfoco_nombre?: string | null
}

interface Props {
  products: { id: string; label: string }[]
  hiperfocoNames: string[]
  sessions: Session[]
  recurringLinks: Record<string, string> // link fijo por tipo (zoom_link_<tipo>)
}

type LinkMode = 'recurrente' | 'unico' | 'pendiente'

// ISO (timestamptz) -> valor para <input type="datetime-local"> en hora local
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY = {
  sessionId: '', title: '', tipo: 'inmersion_1', starts_at: '', ends_at: '',
  zoom_url: '', is_published: true, descripcion: '', hiperfoco_nombre: '', product_id: '',
}

export default function SessionForm({ products, hiperfocoNames, sessions, recurringLinks }: Props) {
  const router = useRouter()
  const [f, setF] = useState({ ...EMPTY })
  const [linkMode, setLinkMode] = useState<LinkMode>('unico')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof f>(key: K, value: (typeof f)[K]) {
    setF(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  // Al cambiar el tipo, si el link es "recurrente" trae el link fijo de ese tipo.
  function setTipo(value: string) {
    setF(prev => ({ ...prev, tipo: value, zoom_url: linkMode === 'recurrente' ? (recurringLinks[value] ?? '') : prev.zoom_url }))
    setError('')
  }

  // Cambio de modo de link: recurrente → trae el link del tipo; pendiente → vacío.
  function changeLinkMode(mode: LinkMode) {
    setLinkMode(mode)
    setF(prev => ({
      ...prev,
      zoom_url: mode === 'recurrente' ? (recurringLinks[prev.tipo] ?? '') : mode === 'pendiente' ? '' : prev.zoom_url,
    }))
    setError('')
  }

  // Al fijar/cambiar el inicio, el fin se recalcula SIEMPRE a +2h (se puede
  // ajustar después manualmente sin que se vuelva a mover, hasta el próximo
  // cambio de inicio).
  function setStart(value: string) {
    setF(prev => ({ ...prev, starts_at: value, ends_at: value ? addHoursLocal(value, 2) : prev.ends_at }))
    setError('')
  }

  function pickSession(sessionId: string) {
    if (!sessionId) { setF({ ...EMPTY }); setLinkMode('unico'); setError(''); return }
    const s = sessions.find(x => x.id === sessionId)
    if (!s) return
    setF({
      sessionId: s.id,
      title: s.title,
      tipo: s.tipo || 'inmersion_1',
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
      zoom_url: s.zoom_url,
      is_published: s.is_published,
      descripcion: s.descripcion ?? '',
      hiperfoco_nombre: s.hiperfoco_nombre ?? '',
      product_id: s.product_id ?? '',
    })
    // Inferir el modo de link de la sesión existente.
    const rl = recurringLinks[s.tipo || 'inmersion_1']
    setLinkMode(!s.zoom_url ? 'pendiente' : (rl && s.zoom_url === rl ? 'recurrente' : 'unico'))
    setError('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.starts_at || !f.ends_at) {
      setError('Elige el inicio y el fin de la sesión.')
      return
    }
    setLoading(true); setError('')
    const res = await fetch('/api/admin/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: f.sessionId || undefined,
        hiperfoco_nombre: f.hiperfoco_nombre,
        product_id: f.product_id,
        title: f.title,
        tipo: f.tipo,
        starts_at: coLocalToISO(f.starts_at),
        ends_at: coLocalToISO(f.ends_at),
        zoom_url: linkMode === 'pendiente' ? '' : f.zoom_url,
        is_published: f.is_published,
        descripcion: f.descripcion,
        // Si el link es recurrente, guardarlo como el fijo de este tipo.
        save_recurring: linkMode === 'recurrente',
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      const msg = data.error ?? 'No se pudo guardar la sesión'
      setError(msg); toast.error(msg); return
    }
    toast.success(f.sessionId ? 'Sesión actualizada.' : 'Sesión creada.')
    setF({ ...EMPTY }); setLinkMode('unico')
    router.refresh()
  }

  async function remove() {
    if (!f.sessionId || !confirm('¿Eliminar esta sesión?')) return
    setLoading(true); setError('')
    const res = await fetch(`/api/admin/sessions?id=${f.sessionId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      const msg = data.error ?? 'No se pudo eliminar'
      setError(msg); toast.error(msg); return
    }
    toast.success('Sesión eliminada.')
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
        Define el hiperfoco, el horario y el link. La ven los clientes con ese hiperfoco (o todos, si es General).
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Sesión</label>
          <select className="select" value={f.sessionId} onChange={e => pickSession(e.target.value)}>
            <option value="">— Nueva sesión —</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {new Date(s.starts_at).toLocaleString('es-CO')} · {s.hiperfoco_nombre ?? 'General'} · {s.title}
              </option>
            ))}
          </select>
          {f.sessionId && <p className="text-xs text-accent mt-1.5">Editando una sesión existente</p>}
        </div>

        <div>
          <label className="label">Hiperfoco *</label>
          <select className="select" value={f.hiperfoco_nombre} onChange={e => set('hiperfoco_nombre', e.target.value)}>
            <option value="">General (todos los clientes)</option>
            {hiperfocoNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <p className="text-xs text-cream-muted mt-1.5">
            La sesión llega a todos los clientes con este hiperfoco, sin importar el producto. "General" la ven todos (ej. Sala de Gerencia).
          </p>
        </div>

        <div>
          <label className="label">Tipo de sesión *</label>
          <select className="select" value={f.tipo} onChange={e => setTipo(e.target.value)} required>
            {SESSION_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Título</label>
          <input type="text" className="input" placeholder="Sesión en vivo"
            value={f.title} onChange={e => set('title', e.target.value)} />
        </div>

        <div>
          <label className="label">Descripción</label>
          <textarea className="input min-h-16 resize-y" placeholder="Qué se verá en la sesión (opcional) — se muestra al cliente en el calendario"
            value={f.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Inicio * <span className="text-cream-muted font-normal">(hora Colombia)</span></label>
            <DateField mode="datetime" required value={f.starts_at} onChange={setStart} />
          </div>
          <div>
            <label className="label">Fin * <span className="text-cream-muted font-normal">(hora Colombia)</span></label>
            <DateField mode="datetime" required value={f.ends_at} onChange={v => set('ends_at', v)} />
          </div>
        </div>
        <p className="text-xs text-cream-muted -mt-2">Al poner el inicio, el fin se completa solo a +2 horas (puedes cambiarlo).</p>

        <div>
          <label className="label">Link de la reunión</label>
          <select className="select mb-2" value={linkMode} onChange={e => changeLinkMode(e.target.value as LinkMode)}>
            <option value="unico">Único — link solo para esta sesión</option>
            <option value="recurrente">Recurrente — link fijo de este tipo</option>
            <option value="pendiente">Se asigna después</option>
          </select>
          {linkMode !== 'pendiente' ? (
            <>
              <input type="url" className="input" placeholder="https://zoom.us/j/..."
                value={f.zoom_url} onChange={e => set('zoom_url', e.target.value)} />
              <p className="text-xs text-cream-muted mt-1.5">
                {linkMode === 'recurrente'
                  ? 'Se guarda como el link fijo de este tipo — la próxima sesión de este tipo lo tomará sola.'
                  : 'Link solo para esta sesión.'}
              </p>
            </>
          ) : (
            <p className="text-xs text-cream-muted">Se crea sin link; el cliente verá "Link próximamente" hasta que la edites y lo pegues.</p>
          )}
        </div>

        <div>
          <label className="label">Restringir a un producto (opcional)</label>
          <select className="select" value={f.product_id} onChange={e => set('product_id', e.target.value)}>
            <option value="">Todos los productos</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <p className="text-xs text-cream-muted mt-1.5">
            Déjalo en "Todos" salvo que quieras la sesión solo para un producto (ej. "Finanzas solo Sabiduría").
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-brand-600"
            checked={f.is_published} onChange={e => set('is_published', e.target.checked)} />
          <span className="text-sm text-cream-dim">Publicada (visible para el cliente)</span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed">
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
