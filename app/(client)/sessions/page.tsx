import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Video, CalendarClock, ArrowRight } from 'lucide-react'
import { sessionTipoLabel } from '@/lib/sessionTypes'
import MiniCalendar from './MiniCalendar'

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
    .eq('product_id', access.product_id)
    .eq('is_published', true)
    .order('starts_at', { ascending: true })

  const now = Date.now()
  const all = sessions ?? []
  const upcoming = all.filter(s => new Date(s.ends_at).getTime() >= now)
  const past = all.filter(s => new Date(s.ends_at).getTime() < now).reverse() // recientes primero

  // Agrupar las próximas por día (lista cronológica clara, no grid de mes)
  const groups: { key: string; label: string; items: typeof upcoming }[] = []
  for (const s of upcoming) {
    const d = new Date(s.starts_at)
    const key = format(d, 'yyyy-MM-dd')
    let g = groups.find(x => x.key === key)
    if (!g) {
      g = { key, label: format(d, "EEEE d 'de' MMMM", { locale: es }), items: [] }
      groups.push(g)
    }
    g.items.push(s)
  }

  const productTitle = (access as any)?.products?.title ?? ''

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="text-cream-muted text-sm">{productTitle}</p>
        <h1 className="page-title mt-1">Mis sesiones en vivo</h1>
        <p className="page-subtitle">Tu calendario de inmersiones, mentorías y demás encuentros.</p>
      </div>

      <MiniCalendar sessionDates={upcoming.map(s => format(new Date(s.starts_at), 'yyyy-MM-dd'))} />

      {upcoming.length === 0 && (
        <div className="card text-center py-10">
          <CalendarClock size={28} className="text-cream-muted mx-auto mb-3" />
          <p className="text-cream font-medium">No tienes sesiones programadas</p>
          <p className="text-cream-muted text-sm mt-1">Cuando se agende una nueva, aparecerá aquí.</p>
        </div>
      )}

      {/* Próximas — agrupadas por día */}
      <div className="space-y-7">
        {groups.map(group => (
          <div key={group.key} id={`session-day-${group.key}`}>
            <p className="section-label flex items-center gap-2 capitalize">
              <CalendarClock size={13} className="text-accent" />
              {group.label}
            </p>
            <div className="space-y-2">
              {group.items.map(s => {
                const start = new Date(s.starts_at)
                const end = new Date(s.ends_at)
                return (
                  <div key={s.id} className="card flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                        <Video size={16} className="text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-cream font-medium leading-snug truncate">{sessionTipoLabel(s.tipo)}</p>
                        <p className="text-sm text-cream-dim mt-0.5">
                          {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/sessions/${s.id}/join`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary shrink-0"
                    >
                      Unirme <ArrowRight size={14} />
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Anteriores — solo referencia, sin botón */}
      {past.length > 0 && (
        <div className="mt-10">
          <p className="section-label">Anteriores</p>
          <div className="space-y-2">
            {past.map(s => (
              <div key={s.id} className="card-sm flex items-center justify-between gap-4 opacity-60">
                <div className="min-w-0">
                  <p className="text-cream-dim text-sm truncate">{sessionTipoLabel(s.tipo)}</p>
                  <p className="text-xs text-cream-muted mt-0.5">
                    {format(new Date(s.starts_at), "d 'de' MMMM · HH:mm", { locale: es })} · terminada
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
