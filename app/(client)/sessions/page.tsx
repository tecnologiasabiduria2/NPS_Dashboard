import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { sessionTipoLabel } from '@/lib/sessionTypes'
import MonthCalendar, { type CalendarEvent } from './MonthCalendar'

export default async function SessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: access } = await supabase
    .from('user_access')
    .select('product_id, products(title)')
    .eq('user_id', user.id).eq('status', 'active').single()
  if (!access) redirect('/access-expired')

  const { data: sessions } = await supabase
    .from('live_sessions')
    .select('id, title, tipo, starts_at, ends_at')
    .eq('product_id', (access as any).product_id)
    .eq('is_published', true)
    .order('starts_at', { ascending: true })

  const now = Date.now()
  const all = sessions ?? []
  const upcoming = all.filter(s => new Date(s.ends_at).getTime() >= now)
  const past = all.filter(s => new Date(s.ends_at).getTime() < now).reverse()

  // Descripción en consulta aparte: si la migración aún no corrió, degrada (sin
  // descripción) sin romper la página.
  const descById: Record<string, string> = {}
  const { data: descRows } = await supabase.from('live_sessions').select('id, descripcion')
  for (const r of (descRows ?? []) as { id: string; descripcion?: string | null }[]) {
    if (r.descripcion) descById[r.id] = r.descripcion
  }

  const events: CalendarEvent[] = all.map(s => ({
    id: s.id,
    date: s.starts_at,
    endsAt: s.ends_at,
    label: sessionTipoLabel(s.tipo),
    subtitle: s.title || undefined,
    tipo: s.tipo,
    descripcion: descById[s.id] ?? null,
    joinHref: `/api/sessions/${s.id}/join`,
  }))

  const productTitle = (access as any)?.products?.title ?? ''

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <p className="text-cream-muted text-sm">{productTitle}</p>
        <h1 className="page-title mt-1">Eventos</h1>
        <p className="page-subtitle">Tu calendario de inmersiones, mentorías y encuentros en vivo.</p>
      </div>

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
                  const d = new Date(s.starts_at)
                  return (
                    <div key={s.id} className="card-sm flex items-center gap-3">
                      <div className="text-center shrink-0 w-10">
                        <p className="text-lg font-semibold text-cream leading-none">{format(d, 'dd')}</p>
                        <p className="text-[10px] text-cream-muted uppercase">{format(d, 'MMM', { locale: es })}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-cream font-medium leading-snug truncate">{sessionTipoLabel(s.tipo)}</p>
                        <p className="text-xs text-cream-muted">{format(d, 'HH:mm')}–{format(new Date(s.ends_at), 'HH:mm')}</p>
                      </div>
                      <a
                        href={`/api/sessions/${s.id}/join`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary shrink-0 py-1.5 px-3 text-xs"
                        aria-label="Unirme"
                      >
                        <ArrowRight size={13} />
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <p className="section-label">Eventos pasados</p>
              <div className="space-y-2">
                {past.slice(0, 8).map(s => {
                  const d = new Date(s.starts_at)
                  return (
                    <div key={s.id} className="card-sm flex items-center gap-3 opacity-60">
                      <div className="text-center shrink-0 w-10">
                        <p className="text-lg font-semibold text-cream-dim leading-none">{format(d, 'dd')}</p>
                        <p className="text-[10px] text-cream-muted uppercase">{format(d, 'MMM', { locale: es })}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-cream-dim leading-snug truncate">{sessionTipoLabel(s.tipo)}</p>
                        <p className="text-xs text-cream-muted">terminada</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Calendario grande */}
        <div className="flex-1 min-w-0 w-full">
          <MonthCalendar events={events} />
        </div>
      </div>
    </div>
  )
}
