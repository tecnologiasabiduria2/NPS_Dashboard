import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { sessionTipoLabel } from '@/lib/sessionTypes'
import { formatCOTime, formatCODayNum, formatCOMonthShort } from '@/lib/format'
import MonthCalendar, { type CalendarEvent } from './MonthCalendar'

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>
}) {
  const { pending } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: accessRows } = await supabase
    .from('user_access')
    .select('product_id, products(title)')
    .eq('user_id', user.id).eq('status', 'active').limit(1)
  const access = accessRows?.[0]
  if (!access) redirect('/access-expired')

  const productId = (access as any).product_id
  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('id, title, tipo, starts_at, ends_at, zoom_url')
    .or(`product_id.is.null,product_id.eq.${productId}`)
    .eq('is_published', true)
    .order('starts_at', { ascending: true })

  // Filtro por hiperfoco (#8v2): el cliente ve las GENERALES (sin hiperfoco) + las de
  // un hiperfoco con su mismo nombre (cualquier producto). Consultas aparte,
  // resilientes si la migración aún no corrió (→ todas se tratan como generales).
  const hfNombreBySession: Record<string, string> = {}
  const { data: hfRows } = await supabase.from('live_sessions').select('id, hiperfoco_nombre')
  for (const r of (hfRows ?? []) as { id: string; hiperfoco_nombre?: string | null }[]) {
    if (r.hiperfoco_nombre) hfNombreBySession[r.id] = r.hiperfoco_nombre
  }
  const { data: myHfRows } = await supabase
    .from('user_hiperfoco_mes').select('hiperfocos(title)').eq('user_id', user.id).not('hiperfoco_id', 'is', null)
  const myHfNames = new Set<string>(
    ((myHfRows ?? []) as any[])
      .map(r => (Array.isArray(r.hiperfocos) ? r.hiperfocos[0]?.title : r.hiperfocos?.title))
      .filter(Boolean)
  )

  const now = Date.now()
  const all = (sessions ?? []).filter(s => { const hf = hfNombreBySession[(s as any).id]; return !hf || myHfNames.has(hf) })
  const upcoming = all.filter(s => new Date(s.ends_at).getTime() >= now)

  // Descripción en consulta aparte: si la migración aún no corrió, degrada (sin
  // descripción) sin romper la página.
  const descById: Record<string, string> = {}
  const { data: descRows } = await supabase.from('live_sessions').select('id, descripcion')
  for (const r of (descRows ?? []) as { id: string; descripcion?: string | null }[]) {
    if (r.descripcion) descById[r.id] = r.descripcion
  }

  // Asistencia (#6): para marcar en el calendario a qué sesiones ya asistió el cliente.
  const { data: attendanceRows } = await supabase
    .from('live_session_attendance')
    .select('session_id')
    .eq('user_id', user.id)
  const attendedIds = new Set((attendanceRows ?? []).map(a => (a as any).session_id))

  const events: CalendarEvent[] = all.map(s => ({
    id: s.id,
    date: s.starts_at,
    endsAt: s.ends_at,
    label: sessionTipoLabel(s.tipo),
    subtitle: s.title || undefined,
    tipo: s.tipo,
    descripcion: descById[s.id] ?? null,
    joinHref: `/api/sessions/${s.id}/join`,
    pending: !(s as any).zoom_url,
    attended: attendedIds.has(s.id),
  }))

  const productTitle = (access as any)?.products?.title ?? ''

  return (
    <div>
      <div className="mb-8">
        <p className="text-cream-muted text-sm">{productTitle}</p>
        <h1 className="page-title mt-1">Eventos</h1>
        <p className="page-subtitle">Tu calendario de inmersiones, mentorías y encuentros en vivo.</p>
      </div>

      {pending === '1' && (
        <div className="bg-accent/10 border border-accent/25 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-sand">El link de esta sesión aún no está disponible. Se publica cerca del evento — vuelve a entrar más tarde.</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Lista lateral: próximos + pasados */}
        <aside className="w-full lg:w-72 shrink-0 space-y-6">
          <div>
            <p className="section-label">Próximos eventos</p>
            {upcoming.length === 0 ? (
              <div className="card-sm text-center py-6">
                <CalendarClock size={22} className="text-cream-muted mx-auto mb-2" />
                <p className="text-sm text-cream-muted">Sin sesiones programadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(s => {
                  return (
                    <div key={s.id} className="card-sm flex items-center gap-3">
                      <div className="text-center shrink-0 w-10">
                        <p className="text-lg font-semibold text-cream leading-none">{formatCODayNum(s.starts_at)}</p>
                        <p className="text-[10px] text-cream-muted uppercase">{formatCOMonthShort(s.starts_at)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-cream font-medium leading-snug truncate">{sessionTipoLabel(s.tipo)}</p>
                        <p className="text-xs text-cream-muted">{formatCOTime(s.starts_at)}–{formatCOTime(s.ends_at)}</p>
                      </div>
                      {(s as any).zoom_url ? (
                        <a
                          href={`/api/sessions/${s.id}/join`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary shrink-0 py-1.5 px-3 text-xs"
                          aria-label="Unirme"
                        >
                          <ArrowRight size={13} />
                        </a>
                      ) : (
                        <span
                          className="shrink-0 text-[10px] text-cream-muted px-2 py-1 rounded-lg bg-surface-800 whitespace-nowrap"
                          title="El link se publica cerca del evento"
                        >
                          Próx.
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </aside>

        {/* Calendario grande */}
        <div className="flex-1 min-w-0 w-full">
          <MonthCalendar events={events} />
        </div>
      </div>
    </div>
  )
}
