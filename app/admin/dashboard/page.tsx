import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, Users, TrendingDown, Clock, CalendarClock, ArrowRight, UserPlus, Star, Briefcase, CalendarX } from 'lucide-react'
import { formatDateOnly } from '@/lib/format'
import NpsTrendChart from '@/components/admin/NpsTrendChart'
import OwnerOpsSection from './OwnerOpsSection'
import DistribucionHiperfocoSection from './DistribucionHiperfocoSection'
import { getClientesEnRiesgoAsistencia } from '@/lib/attendanceRisk'

const TREND_MESES = 6 // "ver la tendencia del último semestre o trimestre" (Diana, 2026-07-06)
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Clave 'YYYY-MM-01' del primer día de un mes (local), desplazando `offset` meses.
function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string; cs_mes?: string; cs?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).single()
    : { data: null }
  const isOwner = profile?.role === 'owner'
  const isAdmin = profile?.role === 'admin'
  const today = new Date().toISOString().split('T')[0]
  const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const soonMonthDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const periodoInicioTrend = periodoKey(-(TREND_MESES - 1))

  const [
    { count: activeCount },
    { count: expiredCount },
    { count: noDateCount },
    { count: soonCount },
    { count: soonMonthCount },
    { count: atencionInmediataCount },
    { data: soonMonthList },
    { data: npsTrendRaw },
  ] = await Promise.all([
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active').is('access_until', null),
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active').lte('access_until', soonDate).gte('access_until', today),
    // Predictibilidad de vencimientos (pedido de Diana, calibración 2026-07-06):
    // "vencen el próximo mes" además de "vencen en 7 días", para anticipar renovaciones.
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active').lte('access_until', soonMonthDate).gte('access_until', today),
    // Solo el conteo — la lista completa de "Requieren atención inmediata" se
    // movió a /admin/clientes-resumen (2026-07-09, pedido de Juan: vive junto
    // al resto del resumen operativo, no en el dashboard general).
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active').or(`access_until.is.null,access_until.lt.${today}`),
    supabase.from('user_access')
      .select('id, user_id, access_until, profiles(full_name), products(title)')
      .eq('status', 'active')
      .lte('access_until', soonMonthDate)
      .gte('access_until', today)
      .order('access_until', { ascending: true })
      .limit(8),
    // NPS global (todas las respuestas, sin distinguir módulo) de los
    // últimos TREND_MESES meses — el desglose por módulo vive en /admin/nps.
    supabase
      .from('nps_responses')
      .select('score, created_at')
      .gte('created_at', periodoInicioTrend),
  ])

  // Resúmenes de los otros 2 pilares (Business Coach, Clientes) — detalle en
  // /admin/business-coach y /admin/clientes-resumen (calibración 2026-07-07 noche).
  // Un KPI por Business Coach (no un total combinado — pedido de Juan,
  // 2026-07-07 noche: "escalable", 1 tarjeta por cada uno con sus clientes).
  const periodoActualBC = periodoKey(0)
  const [{ data: bcRoster }, { data: uhmMesBC }, clientesEnRiesgo] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'admin').order('full_name'),
    supabase.from('user_hiperfoco_mes').select('user_id, cs_id').eq('periodo', periodoActualBC).eq('estado', 'en_curso').not('cs_id', 'is', null),
    getClientesEnRiesgoAsistencia(),
  ])
  const clientesPorBC = new Map<string, number>()
  for (const r of (uhmMesBC as any[]) ?? []) clientesPorBC.set(r.cs_id, (clientesPorBC.get(r.cs_id) ?? 0) + 1)
  const businessCoaches = ((bcRoster as any[]) ?? []).map(p => ({
    id: p.id as string,
    name: p.full_name as string,
    clientes: clientesPorBC.get(p.id) ?? 0,
  }))
  const resumenOperativoCount = (atencionInmediataCount ?? 0) + clientesEnRiesgo.length

  // Meses del rango de tendencia, en orden ascendente (más viejo primero).
  const mesesTrend = Array.from({ length: TREND_MESES }, (_, i) => periodoKey(-(TREND_MESES - 1) + i).slice(0, 7))

  const npsPorMesGlobal = new Map<string, { sum: number; count: number }>()
  for (const r of (npsTrendRaw ?? []) as any[]) {
    const mesKey = String(r.created_at).slice(0, 7)
    const d = npsPorMesGlobal.get(mesKey) ?? { sum: 0, count: 0 }
    d.sum += r.score
    d.count++
    npsPorMesGlobal.set(mesKey, d)
  }
  const npsTrendGlobal = mesesTrend.map(m => {
    const d = npsPorMesGlobal.get(m)
    const [y, mo] = m.split('-').map(Number)
    return { label: MES_CORTO[mo - 1], value: d ? Math.round((d.sum / d.count) * 10) / 10 : 0 }
  })

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title inline-flex items-baseline gap-2">
            Dashboard
            <span className="text-sm font-normal text-cream-muted">{new Date().getFullYear()}</span>
          </h1>
          <p className="page-subtitle">Resumen de la plataforma</p>
        </div>
        <Link href="/admin/clients/create" className="btn-primary">
          <UserPlus size={16} /> Nuevo cliente
        </Link>
      </div>

      {/* KPIs — superficie monocromática (misma .card que el resto del
          dashboard) con un glow ambiental de color por tarjeta, mismo
          lenguaje que ya usan NPS Global/Business Coach/Resumen operativo
          (.card-glow + .card-glow-orb). Reemplaza el degradado diagonal
          plano (2026-07-08) que Sebastián señaló que ya no combinaba tras el
          cambio de fondo a azul-violeta (2026-07-09) — no era cuestión de
          elegir otros tintes, era que el degradado en sí rompía con el resto
          de la app. "Sin fecha" solo enciende su rojo cuando el conteo es
          mayor a 0 (mismo patrón condicional que ya usa "Resumen operativo"
          más abajo); los otros 4 llevan su acento siempre, incluido
          "Inactivos" con el mismo tono cream-dim que ya usa la app para
          texto secundario — para que ningún KPI se sienta "sin efecto". */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Activos', value: activeCount ?? 0, icon: Users, orb: '#DA7D41', iconBg: 'bg-brand-600/15', iconText: 'text-brand-400' },
          { label: 'Inactivos', value: expiredCount ?? 0, icon: TrendingDown, orb: '#C0AA90', iconBg: 'bg-cream-dim/15', iconText: 'text-cream-dim' },
          { label: 'Sin fecha', value: noDateCount ?? 0, icon: AlertTriangle, urgent: true },
          { label: 'Vencen en 7d', value: soonCount ?? 0, icon: Clock, orb: '#F59E0B', iconBg: 'bg-amber-500/10', iconText: 'text-amber-400' },
          { label: 'Vencen próx. mes', value: soonMonthCount ?? 0, icon: CalendarClock, orb: '#EAAD74', iconBg: 'bg-sand/10', iconText: 'text-sand' },
        ].map(({ label, value, icon: Icon, orb: staticOrb, iconBg: staticIconBg, iconText: staticIconText, urgent }, i) => {
          const isUrgentActive = urgent && Number(value) > 0
          const orb = urgent ? (isUrgentActive ? '#EF4444' : null) : staticOrb
          const iconBg = urgent ? (isUrgentActive ? 'bg-red-500/10' : 'bg-surface-700') : staticIconBg
          const iconText = urgent ? (isUrgentActive ? 'text-red-400' : 'text-cream-muted') : staticIconText
          return (
            <div
              key={label}
              className={`card card-glow animate-fade-up ${isUrgentActive ? 'border-red-500/30' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {orb && <div className="card-glow-orb opacity-20" style={{ background: orb }} />}
              <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
                <Icon size={19} className={iconText} />
              </div>
              <p className={`relative text-3xl font-bold tabular-nums ${isUrgentActive ? 'text-red-400' : 'text-cream'}`}>{value}</p>
              <p className="relative text-xs text-cream-muted mt-1">{label}</p>
            </div>
          )
        })}
      </div>

      {/* NPS Global — hero a todo el ancho, justo debajo de los KPIs (réplica
          de propuesta_dark.png). El desglose por módulo/hiperfoco y el filtro
          de meses viven en /admin/nps (calibración 2026-07-06). */}
      <div className="card card-glow animate-fade-up mb-8" style={{ animationDelay: '360ms' }}>
        <div className="card-glow-orb opacity-20" style={{ background: '#DA7D41' }} />
        <div className="relative flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-amber-400" />
            <p className="text-sm font-medium text-cream">NPS Global · últimos {TREND_MESES} meses</p>
          </div>
          <Link href="/admin/nps" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            Ver desglose por módulo <ArrowRight size={12} />
          </Link>
        </div>
        <div className="relative">
          <NpsTrendChart data={npsTrendGlobal} height={220} />
        </div>
      </div>

      {/* Distribución por hiperfoco — debajo de NPS Global (réplica de
          propuesta_dark.png; antes iba arriba de NPS). Solo owner. */}
      {isOwner && <DistribucionHiperfocoSection searchParams={searchParams} />}

      {/* Resumen de los otros 2 pilares (NPS ya tiene su tarjeta arriba) — un
          KPI por Business Coach (escalable: 1 tarjeta por cada uno, con sus
          clientes asignados) + Clientes en riesgo por asistencia, cada uno
          con su apartado de detalle (calibración 2026-07-07 noche). */}
      {(isOwner || isAdmin) && (
        <div className="flex flex-wrap gap-4 mb-8">
          {businessCoaches.map(bc => (
            <Link
              key={bc.id}
              href="/admin/business-coach"
              className="card card-glow flex items-center gap-4 hover:border-brand-600/40 transition-colors flex-1 min-w-[240px]"
            >
              <div className="card-glow-orb opacity-20" style={{ background: '#DA7D41' }} />
              <div className="relative w-11 h-11 rounded-xl bg-brand-600/15 flex items-center justify-center shrink-0">
                <Briefcase size={19} className="text-brand-400" />
              </div>
              <div className="relative flex-1 min-w-0">
                <p className="text-3xl font-bold tabular-nums text-cream">{bc.clientes}</p>
                <p className="text-xs text-cream-muted mt-1 truncate">{bc.name} — ver detalle</p>
              </div>
              <ArrowRight size={16} className="relative text-cream-muted shrink-0" />
            </Link>
          ))}
          <Link
            href="/admin/clientes-resumen"
            className="card card-glow flex items-center gap-4 hover:border-brand-600/40 transition-colors flex-1 min-w-[240px]"
          >
            {/* Resumen operativo — fusiona "requieren atención inmediata" (sin
                fecha/vencidos) + "en riesgo por asistencia" en un solo número,
                mismo patrón que NPS/Business Coach: resumen en el dashboard,
                detalle en /admin/clientes-resumen (2026-07-09, pedido de Juan). */}
            {resumenOperativoCount > 0 && <div className="card-glow-orb opacity-20" style={{ background: '#f87171' }} />}
            <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${resumenOperativoCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              <CalendarX size={19} className={resumenOperativoCount > 0 ? 'text-red-400' : 'text-emerald-400'} />
            </div>
            <div className="relative flex-1 min-w-0">
              <p className={`text-3xl font-bold tabular-nums ${resumenOperativoCount > 0 ? 'text-red-400' : 'text-cream'}`}>{resumenOperativoCount}</p>
              <p className="text-xs text-cream-muted mt-1">Resumen operativo — ver detalle</p>
            </div>
            <ArrowRight size={16} className="relative text-cream-muted shrink-0" />
          </Link>
        </div>
      )}

      {isOwner && <OwnerOpsSection searchParams={searchParams} />}

      {/* Vencimientos próximos — predictibilidad de renovaciones (pedido de
          Diana, calibración 2026-07-06). "Requieren atención inmediata" (sin
          fecha o ya vencidos) se movió a /admin/clientes-resumen (2026-07-09),
          junto al resto del resumen operativo — el KPI de arriba enlaza ahí. */}
      {soonMonthList && soonMonthList.length > 0 && (
        <div className="card border-sky-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-sky-400" />
              <p className="text-sm font-medium text-cream">Vencimientos próximos (30 días)</p>
            </div>
            <Link href="/admin/clients" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-surface-700">
            {(soonMonthList as any[]).map((a: any) => (
              <Link key={a.id} href={`/admin/clients/${a.user_id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-surface-800/50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center">
                      <span className="text-xs text-cream-muted font-medium">
                        {(a.profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-cream font-medium">{a.profiles?.full_name ?? '—'}</p>
                      <p className="text-xs text-cream-muted">{a.products?.title}</p>
                    </div>
                  </div>
                  <span className={a.access_until <= soonDate ? 'badge-warning' : 'text-xs text-cream-muted'}>
                    {formatDateOnly(a.access_until)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
