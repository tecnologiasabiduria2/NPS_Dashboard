import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowRight, Video, Calendar, AlertTriangle, Target, History } from 'lucide-react'
import { formatDateOnly, formatMonthLong, formatMonthShort } from '@/lib/format'

// Metadatos de presentación por estado del hiperfoco (modelo de hiperfoco, B10).
// Estados de user_hiperfoco_mes: no_elegido | en_curso | cerrado | pausa.
const ESTADO_META: Record<string, { label: string; chip: string }> = {
  en_curso:   { label: 'en curso',    chip: 'bg-sky-500/15 text-sky-300' },
  cerrado:    { label: 'cerrado',     chip: 'bg-emerald-500/15 text-emerald-300' },
  pausa:      { label: 'descanso',    chip: 'bg-surface-700 text-cream-muted' },
  no_elegido: { label: 'sin asignar', chip: 'bg-surface-700 text-cream-dim' },
}

// Color del NPS por score. Umbrales según el boceto sabiduria_dashboard_cliente.html
// (8 y 9 en verde, 7 en ámbar). La vista CS usa su propio umbral por su boceto.
function npsColorClass(score: number) {
  if (score >= 8) return 'text-emerald-400'
  if (score >= 6) return 'text-amber-400'
  return 'text-red-400'
}

type HiperfocoRow = {
  periodo: string
  estado: string
  hiperfoco_id: string | null
  hiperfocos: { title: string } | null
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: access }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('user_access')
      .select('*, products(title, slug)')
      .eq('user_id', user.id).eq('status', 'active').single(),
  ])

  // Periodo del mes actual = primer día del mes en hora local (coincide con la
  // columna DATE user_hiperfoco_mes.periodo, que es siempre date_trunc('month')).
  const now = new Date()
  const periodoActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Hiperfoco del mes actual (lo asigna la CS; el cliente solo lo visualiza).
  let hiperfocoMes: HiperfocoRow | null = null
  // Historial mensual de hiperfocos (más reciente primero).
  let historial: HiperfocoRow[] = []
  // Campos derivados del historial (B10 segunda vuelta), por clave 'YYYY-MM':
  //   - asistió: hubo asistencia a una sesión del producto ese mes
  //   - NPS del mes: respuesta más reciente de ese mes
  const mesesAsistidos = new Set<string>()
  const npsPorMes = new Map<string, number>()
  if (access?.product_id) {
    const [{ data: mes }, { data: hist }, { data: attendanceRaw }, { data: npsRaw }] = await Promise.all([
      supabase
        .from('user_hiperfoco_mes')
        .select('periodo, estado, hiperfoco_id, hiperfocos(title)')
        .eq('user_id', user.id)
        .eq('product_id', access.product_id)
        .eq('periodo', periodoActual)
        .maybeSingle(),
      supabase
        .from('user_hiperfoco_mes')
        .select('periodo, estado, hiperfoco_id, hiperfocos(title)')
        .eq('user_id', user.id)
        .eq('product_id', access.product_id)
        .order('periodo', { ascending: false })
        .limit(12),
      supabase
        .from('live_session_attendance')
        .select('live_sessions!inner(starts_at, product_id)')
        .eq('user_id', user.id)
        .eq('live_sessions.product_id', access.product_id),
      supabase.from('nps_responses').select('score, created_at').eq('user_id', user.id),
    ])
    hiperfocoMes = mes as HiperfocoRow | null
    historial = (hist as HiperfocoRow[] | null) ?? []

    for (const a of (attendanceRaw as any[]) ?? []) {
      const key = (a.live_sessions?.starts_at as string | undefined)?.slice(0, 7)
      if (key) mesesAsistidos.add(key)
    }
    // Orden ascendente por fecha → la última escritura por mes gana (la más reciente).
    for (const r of ((npsRaw as any[]) ?? [])
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
      npsPorMes.set(String(r.created_at).slice(0, 7), r.score)
    }
  }

  // Historial enriquecido: asistió / repitió (mismo hiperfoco que el mes anterior) / NPS.
  const historialView = historial.map((row, i, arr) => {
    const mesKey = String(row.periodo).slice(0, 7)
    const prev = arr[i + 1] // siguiente en orden desc = mes anterior
    return {
      ...row,
      asistio: mesesAsistidos.has(mesKey),
      repitio: Boolean(row.hiperfoco_id) && prev?.hiperfoco_id === row.hiperfoco_id,
      nps: npsPorMes.get(mesKey) ?? null,
    }
  })

  // Próxima sesión en vivo del producto activo (publicada y aún no terminada)
  let nextSession: { id: string; title: string; starts_at: string } | null = null
  if (access?.product_id) {
    const { data: session } = await supabase
      .from('live_sessions')
      .select('id, title, starts_at')
      .eq('product_id', access.product_id)
      .eq('is_published', true)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    nextSession = session
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Bienvenido'
  const productTitle = (access as any)?.products?.title ?? ''

  // Estado efectivo del mes: si no hay fila, se considera "no_elegido".
  const estadoMes = hiperfocoMes?.estado ?? 'no_elegido'
  const tituloMes = hiperfocoMes?.hiperfocos?.title ?? null
  const tieneHiperfocoMes = Boolean(tituloMes) && (estadoMes === 'en_curso' || estadoMes === 'cerrado')

  return (
    <div className="max-w-4xl">
      {/* Aviso de error (ej. sesión no encontrada al unirse al Zoom) */}
      {error === 'session_not_found' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">
            La sesión en vivo a la que intentabas unirte ya no está disponible.
            Revisa tu próximo evento aquí abajo.
          </p>
        </div>
      )}

      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-cream-muted text-sm mb-1">{productTitle}</p>
            <h1 className="text-3xl font-semibold text-cream">Hola, {firstName}</h1>
          </div>
          {access?.access_until && (
            <div className="text-right">
              <p className="text-xs text-cream-muted">Acceso hasta</p>
              <p className="text-sm text-cream font-medium">
                {formatDateOnly(access.access_until, { day: 'numeric', month: 'long' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hiperfoco del mes */}
      <div
        className="card mb-6"
        style={{ background: 'linear-gradient(135deg, #11201B 0%, #0E2A22 100%)', borderColor: 'rgba(29,158,117,0.35)' }}
      >
        <p className="section-label !text-emerald-300/80">
          Este mes · {formatMonthLong(periodoActual).toUpperCase()}
        </p>
        {tieneHiperfocoMes ? (
          <div className="flex items-center gap-4 mt-2">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Target size={18} className="text-emerald-300" />
            </div>
            <div className="flex-1">
              <p className="text-xl font-semibold text-cream leading-snug">
                Tu hiperfoco: {tituloMes}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 ${ESTADO_META[estadoMes]?.chip ?? ESTADO_META.no_elegido.chip}`}>
              {ESTADO_META[estadoMes]?.label ?? estadoMes}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-4 mt-2">
            <div className="w-11 h-11 rounded-xl bg-surface-700 flex items-center justify-center shrink-0">
              <Target size={18} className="text-cream-muted" />
            </div>
            <div className="flex-1">
              <p className="text-base font-medium text-cream leading-snug">
                {estadoMes === 'pausa'
                  ? 'Mes en pausa'
                  : 'Aún no tienes un hiperfoco asignado este mes'}
              </p>
              <p className="text-sm text-cream-muted mt-0.5">
                {estadoMes === 'pausa'
                  ? 'Este mes es de descanso. Retomamos el próximo.'
                  : 'Tu Customer Success definirá tu enfoque junto contigo.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Historial de hiperfocos */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <History size={15} className="text-brand-400" />
          <p className="text-sm font-medium text-cream">Mi historial de hiperfocos</p>
        </div>

        {historialView.length === 0 ? (
          <p className="text-sm text-cream-muted">
            Todavía no hay hiperfocos registrados. Aparecerán aquí mes a mes.
          </p>
        ) : (
          <div className="flex flex-col">
            {historialView.map((row, i) => {
              const meta = ESTADO_META[row.estado] ?? ESTADO_META.no_elegido
              const conHiperfoco = Boolean(row.hiperfocos?.title)
              return (
                <div
                  key={row.periodo}
                  className={`grid grid-cols-[88px_1fr_auto] gap-3 items-center py-2.5 ${
                    i < historialView.length - 1 ? 'border-b border-surface-700/60' : ''
                  }`}
                >
                  <span className="text-xs text-cream-muted capitalize">
                    {formatMonthShort(row.periodo)}
                  </span>
                  <span className={`text-sm ${conHiperfoco ? 'text-cream' : 'text-cream-muted'}`}>
                    {row.hiperfocos?.title ?? (row.estado === 'pausa' ? 'Pausa' : 'Sin asignar')}
                    {row.repitio && <span className="text-xs text-cream-muted ml-1.5">· repitió</span>}
                    {row.asistio && <span className="text-xs text-cream-muted ml-1.5">· asistió ✓</span>}
                  </span>
                  {/* El NPS del mes reemplaza al chip de estado cuando existe (ver boceto). */}
                  {row.nps !== null ? (
                    <span className={`text-sm font-medium text-right ${npsColorClass(row.nps)}`}>
                      NPS {row.nps}
                    </span>
                  ) : (
                    <span className={`text-xs px-2.5 py-1 rounded-full ${meta.chip}`}>
                      {meta.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Próximo evento en vivo */}
      {nextSession && (
        <div
          className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ background: 'linear-gradient(135deg, #1A1215 0%, #2A0E07 100%)' }}
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <Video size={18} className="text-accent" />
            </div>
            <div>
              <p className="section-label !mb-1">Próximo evento</p>
              <p className="text-cream font-medium leading-snug">{nextSession.title}</p>
              <p className="text-sm text-cream-dim mt-1 inline-flex items-center gap-1.5 capitalize">
                <Calendar size={12} className="text-sand" />
                {format(new Date(nextSession.starts_at), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
              </p>
            </div>
          </div>
          <a
            href={`/api/sessions/${nextSession.id}/join`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary shrink-0 self-start sm:self-auto"
          >
            Unirme al Zoom <ArrowRight size={14} />
          </a>
        </div>
      )}
    </div>
  )
}
