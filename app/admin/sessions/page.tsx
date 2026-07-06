import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import SessionForm from './SessionForm'
import DeleteSessionButton from './DeleteSessionButton'
import CopyNpsLink from './CopyNpsLink'
import CopyJoinLink from './CopyJoinLink'
import SendNpsEmailsButton from './SendNpsEmailsButton'
import { Calendar, Video } from 'lucide-react'
import { sessionTipoLabel } from '@/lib/sessionTypes'
import { formatCODateTime } from '@/lib/format'
import { countPendingNpsEmails } from '@/lib/npsEmail'

export default async function AdminSessionsPage() {
  const supabase = await createClient()
  const pendingNps = await countPendingNpsEmails()

  const [{ data: products }, { data: sessRows }] = await Promise.all([
    supabase.from('products').select('id, title, slug').order('order'),
    supabase
      .from('live_sessions')
      .select('id, title, tipo, starts_at, ends_at, zoom_url, is_published, product_id')
      .order('starts_at', { ascending: true }),
  ])

  const prodTitle = new Map<string, string>(((products ?? []) as any[]).map(p => [p.id, p.title]))

  // Nombres de hiperfoco distintos (para el selector primario del form).
  const { data: hfList } = await supabase.from('hiperfocos').select('title').eq('is_active', true)
  const hiperfocoNames = Array.from(new Set(((hfList ?? []) as any[]).map(h => h.title as string))).sort()

  // Links recurrentes por tipo (platform_settings, key = zoom_link_<tipo>).
  // RLS sin policies → se lee con service role.
  const recurringLinks: Record<string, string> = {}
  const { data: rlRows } = await supabaseAdmin.from('platform_settings').select('key, value').like('key', 'zoom_link_%')
  for (const r of (rlRows ?? []) as { key: string; value: string }[]) {
    recurringLinks[r.key.replace('zoom_link_', '')] = r.value
  }

  // Campos opcionales en consultas aparte (resiliente si la migración no corrió).
  const descById: Record<string, string> = {}
  const { data: descRows } = await supabase.from('live_sessions').select('id, descripcion')
  for (const r of (descRows ?? []) as { id: string; descripcion?: string | null }[]) if (r.descripcion) descById[r.id] = r.descripcion

  const hfNombreById: Record<string, string> = {}
  const { data: hfNombreRows } = await supabase.from('live_sessions').select('id, hiperfoco_nombre')
  for (const r of (hfNombreRows ?? []) as { id: string; hiperfoco_nombre?: string | null }[]) if (r.hiperfoco_nombre) hfNombreById[r.id] = r.hiperfoco_nombre

  const npsTokenById: Record<string, string> = {}
  const { data: tokenRows } = await supabase.from('live_sessions').select('id, nps_token')
  for (const r of (tokenRows ?? []) as { id: string; nps_token?: string | null }[]) if (r.nps_token) npsTokenById[r.id] = r.nps_token

  const sessions = ((sessRows ?? []) as any[]).map(s => ({
    id: s.id,
    title: s.title,
    tipo: s.tipo,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    zoom_url: s.zoom_url,
    is_published: s.is_published,
    product_id: s.product_id ?? '',
    descripcion: descById[s.id] ?? null,
    hiperfoco_nombre: hfNombreById[s.id] ?? null,
  }))

  const productOptions = ((products ?? []) as any[]).map(p => ({ id: p.id, label: p.title }))
  const now = Date.now()
  const upcoming = sessions.filter(s => new Date(s.ends_at).getTime() >= now)
  const past = sessions.filter(s => new Date(s.ends_at).getTime() < now).reverse()

  const renderRow = (s: (typeof sessions)[number]) => {
    const ended = new Date(s.ends_at).getTime() < now
    return (
      <div key={s.id} className="flex items-center justify-between bg-surface-800 rounded-lg px-3 py-2.5 gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Video size={13} className={`${ended ? 'text-cream-muted' : 'text-accent'} mt-0.5 shrink-0`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm text-cream truncate">{sessionTipoLabel(s.tipo)}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-600/15 text-brand-300">
                {s.hiperfoco_nombre ?? 'General'}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-cream-dim">
                {s.product_id ? (prodTitle.get(s.product_id) ?? 'Producto') : 'Todos'}
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
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={22} className="text-brand-400" />
          <h1 className="page-title">Sesiones en vivo</h1>
        </div>
        <SendNpsEmailsButton initialPending={pendingNps} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Formulario */}
        <SessionForm products={productOptions} hiperfocoNames={hiperfocoNames} sessions={sessions} recurringLinks={recurringLinks} />

        {/* Listado separado: próximas / pasadas (hora Colombia) */}
        <div className="space-y-4">
          <div className="card">
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
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-cream-dim">Pasadas</h2>
                <span className="text-xs text-cream-muted">{past.length}</span>
              </div>
              <div className="space-y-2 opacity-70">{past.slice(0, 15).map(renderRow)}</div>
              {past.length > 15 && <p className="text-xs text-cream-muted mt-2 text-center">y {past.length - 15} más…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
