'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'

export interface Member {
  id: string
  name: string
  role: string
  joined: string | null
  bio: string | null
  avatarUrl: string | null
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function joinedLabel(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MembersList({ members }: { members: Member[] }) {
  const [tab, setTab] = useState<'miembros' | 'equipo'>('miembros')
  const [q, setQ] = useState('')

  const equipoRoles = ['admin', 'owner']
  const miembros = members.filter(m => !equipoRoles.includes(m.role))
  const equipo = members.filter(m => equipoRoles.includes(m.role))

  const base = tab === 'miembros' ? miembros : equipo
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return base
    return base.filter(m =>
      m.name.toLowerCase().includes(s) ||
      (m.bio ?? '').toLowerCase().includes(s)
    )
  }, [base, q])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1">
          {(['miembros', 'equipo'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                tab === t ? 'bg-brand-600/15 text-brand-400 border border-brand-600/25' : 'text-cream-muted hover:text-cream'
              )}
            >
              {t === 'miembros' ? 'Miembros' : 'Equipo'}{' '}
              <span className="text-xs text-cream-dim">{t === 'miembros' ? miembros.length : equipo.length}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar miembro"
            className="input pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-cream-muted">No hay miembros que mostrar.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(m => (
            <div key={m.id} className="card flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-brand-700/50 border border-brand-600/30 flex items-center justify-center shrink-0">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-brand-300">{initials(m.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-cream truncate">{m.name}</p>
                  {equipoRoles.includes(m.role) && (
                    <span className="badge-brand">{m.role === 'owner' ? 'Owner' : 'Admin'}</span>
                  )}
                </div>
                {joinedLabel(m.joined) && (
                  <p className="text-xs text-cream-muted mt-0.5">Unido {joinedLabel(m.joined)}</p>
                )}
                {m.bio && <p className="text-sm text-cream-dim mt-1.5 leading-relaxed">{m.bio}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
