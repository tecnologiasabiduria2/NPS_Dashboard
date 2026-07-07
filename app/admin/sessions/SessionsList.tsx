'use client'

import { useMemo, useState } from 'react'
import { Search, Video } from 'lucide-react'
import { sessionTipoLabel } from '@/lib/sessionTypes'
import { formatCODateTime } from '@/lib/format'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import CopyNpsLink from './CopyNpsLink'
import CopyJoinLink from './CopyJoinLink'
import DeleteSessionButton from './DeleteSessionButton'

interface SessionRow {
  id: string
  title: string | null
  tipo: string
  starts_at: string
  ends_at: string
  zoom_url: string | null
  is_published: boolean
  product_id: string
  hiperfoco_nombre: string | null
}

export default function SessionsList({
  sessions,
  prodTitle,
  npsTokenById,
}: {
  sessions: SessionRow[]
  prodTitle: Record<string, string>
  npsTokenById: Record<string, string>
}) {
  const [q, setQ] = useState('')
  const now = Date.now()

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return sessions
    return sessions.filter(s =>
      (s.title ?? '').toLowerCase().includes(t) ||
      sessionTipoLabel(s.tipo).toLowerCase().includes(t) ||
      (s.hiperfoco_nombre ?? '').toLowerCase().includes(t)
    )
  }, [sessions, q])

  const upcoming = filtered.filter(s => new Date(s.ends_at).getTime() >= now)
  const past = filtered.filter(s => new Date(s.ends_at).getTime() < now).reverse()

  function renderRow(s: SessionRow) {
    const ended = new Date(s.ends_at).getTime() < now
    return (
      <div key={s.id} className="flex items-center justify-between bg-surface-800 rounded-lg px-3 py-2.5 gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Video size={13} className={`${ended ? 'text-cream-muted' : 'text-accent'} mt-0.5 shrink-0`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm text-cream truncate">{sessionTipoLabel(s.tipo)}</p>
              {s.hiperfoco_nombre ? (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                  style={{ background: `${getHiperfocoVisual(s.hiperfoco_nombre).solid}22`, color: getHiperfocoVisual(s.hiperfoco_nombre).solid }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: getHiperfocoVisual(s.hiperfoco_nombre).solid }} />
                  {s.hiperfoco_nombre}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-600/15 text-brand-300">General</span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-cream-dim">
                {s.product_id ? (prodTitle[s.product_id] ?? 'Producto') : 'Todos'}
              </span>
            </div>
            <p className="text-xs text-cream-muted mt-0.5 truncate">
              {formatCODateTime(s.starts_at)}
              {s.title ? ` · ${s.title}` : ''}
              {!s.zoom_url ? ' · sin link' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={s.is_published ? 'badge-active' : 'badge-pending'}>
            {s.is_published ? 'Pub.' : 'Borrador'}
          </span>
          <CopyJoinLink sessionId={s.id} />
          {npsTokenById[s.id] && <CopyNpsLink token={npsTokenById[s.id]} />}
          <DeleteSessionButton sessionId={s.id} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-muted" />
        <input
          type="text"
          className="input pl-9 text-sm"
          placeholder="Buscar por título, tipo o hiperfoco…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="card animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-cream">Próximas</h2>
          <span className="text-xs text-cream-muted">{upcoming.length} · hora Colombia</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-cream-muted text-center py-3">Sin sesiones próximas</p>
        ) : (
          <div className="space-y-2">{upcoming.map(renderRow)}</div>
        )}
      </div>

      {past.length > 0 && (
        <div className="card animate-fade-up" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-cream-dim">Pasadas</h2>
            <span className="text-xs text-cream-muted">{past.length}</span>
          </div>
          <div className="space-y-2 opacity-70">{past.slice(0, 15).map(renderRow)}</div>
          {past.length > 15 && <p className="text-xs text-cream-muted mt-2 text-center">y {past.length - 15} más…</p>}
        </div>
      )}
    </div>
  )
}
