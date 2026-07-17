'use client'

import { useMemo, useState } from 'react'
import { Search, X, MessageCircle, Instagram, Globe } from 'lucide-react'
import { clsx } from 'clsx'
import { whatsappHref } from '@/lib/phone'

export interface Member {
  id: string
  name: string
  role: string
  joined: string | null
  bio: string | null
  avatarUrl: string | null
  phone: string | null
  instagram: string | null
  website: string | null
  sector: string | null
  productoServicio: string | null
}

// Acepta handle ("@negocio"), usuario suelto o URL completa; siempre devuelve
// un link válido a instagram.com.
function instagramHref(value: string): string {
  const v = value.trim()
  if (v.startsWith('http')) return v
  return `https://instagram.com/${v.replace(/^@/, '')}`
}

// Acepta con o sin protocolo.
function websiteHref(value: string): string {
  const v = value.trim()
  return v.startsWith('http') ? v : `https://${v}`
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
  const [selected, setSelected] = useState<Member | null>(null)

  const equipoRoles = ['admin', 'owner']
  const miembros = members.filter(m => !equipoRoles.includes(m.role))
  const equipo = members.filter(m => equipoRoles.includes(m.role))

  const base = tab === 'miembros' ? miembros : equipo
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return base
    return base.filter(m =>
      m.name.toLowerCase().includes(s) ||
      (m.bio ?? '').toLowerCase().includes(s) ||
      (m.sector ?? '').toLowerCase().includes(s) ||
      (m.productoServicio ?? '').toLowerCase().includes(s)
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
            placeholder="Buscar por nombre, sector o producto"
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
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="card flex items-start gap-3.5 w-full text-left hover:border-brand-600/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
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
                {(m.sector || m.productoServicio) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.sector && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-300 border border-brand-600/25">{m.sector}</span>
                    )}
                    {m.productoServicio && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-800 text-cream-dim border border-surface-700">{m.productoServicio}</span>
                    )}
                  </div>
                )}
                {m.bio && <p className="text-sm text-cream-dim mt-1.5 leading-relaxed">{m.bio}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Panel de info del miembro */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm card max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-cream-muted hover:text-cream"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-brand-700/50 border border-brand-600/30 flex items-center justify-center shrink-0 mb-3">
                {selected.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.avatarUrl} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-brand-300">{initials(selected.name)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-cream">{selected.name}</p>
                {equipoRoles.includes(selected.role) && (
                  <span className="badge-brand">{selected.role === 'owner' ? 'Owner' : 'Admin'}</span>
                )}
              </div>
              {joinedLabel(selected.joined) && (
                <p className="text-xs text-cream-muted mt-1">Unido {joinedLabel(selected.joined)}</p>
              )}
              {(selected.sector || selected.productoServicio) && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {selected.sector && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-600/15 text-brand-300 border border-brand-600/25">{selected.sector}</span>
                  )}
                  {selected.productoServicio && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-800 text-cream-dim border border-surface-700">{selected.productoServicio}</span>
                  )}
                </div>
              )}
              {selected.bio && (
                <p className="text-sm text-cream-dim mt-3 leading-relaxed">{selected.bio}</p>
              )}

              {(selected.instagram || selected.website) && (
                <div className="flex flex-col items-center gap-1.5 mt-3">
                  {selected.instagram && (
                    <a
                      href={instagramHref(selected.instagram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-accent transition-colors"
                    >
                      <Instagram size={14} /> Instagram
                    </a>
                  )}
                  {selected.website && (
                    <a
                      href={websiteHref(selected.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-accent transition-colors"
                    >
                      <Globe size={14} /> Página web
                    </a>
                  )}
                </div>
              )}

              {selected.phone && (
                <a
                  href={whatsappHref(selected.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2.5 rounded-xl transition-all duration-200 text-sm flex items-center gap-2 mt-5 w-full justify-center"
                >
                  <MessageCircle size={15} />
                  Escribir por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
