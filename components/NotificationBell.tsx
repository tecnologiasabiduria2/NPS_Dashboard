'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

// Campana de notificaciones (2026-07-15, Fase 6): reemplaza el placeholder
// deshabilitado que ya vivía en CommunityShell.tsx. Sin Supabase Realtime (no
// se usa en el proyecto) — se refresca por polling simple cada 60s, suficiente
// para esta escala sin introducir infraestructura nueva.
const POLL_MS = 60000

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json()
      setItems(json.notifications ?? [])
      setUnread(json.unreadCount ?? 0)
    } catch {
      // silencioso — la campana simplemente no se actualiza este ciclo
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [])

  async function markAllRead() {
    setLoading(true)
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      await load()
    } catch {
      // silencioso
    }
    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Notificaciones"
        className="relative p-2 rounded-xl text-cream-muted hover:text-cream hover:bg-surface-800 transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-40 bg-surface-850 border border-surface-700 rounded-xl shadow-xl py-1.5 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface-700 mb-1">
              <p className="text-sm font-medium text-cream">Notificaciones</p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-xs text-cream-muted hover:text-cream disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {loading ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                  Marcar todas
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-cream-muted text-center py-6">Sin notificaciones</p>
            ) : (
              items.map(n => {
                const body = (
                  <div className={clsx('px-3 py-2.5 hover:bg-surface-800 transition-colors flex items-start gap-2', !n.read_at && 'bg-accent/5')}>
                    {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm text-cream leading-snug">{n.title}</p>
                      {n.body && <p className="text-xs text-cream-muted truncate mt-0.5">{n.body}</p>}
                      <p className="text-[11px] text-cream-dim mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>{body}</Link>
                ) : (
                  <div key={n.id}>{body}</div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
