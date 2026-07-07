import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, Users, TrendingDown, Clock, CalendarClock, ArrowRight, UserPlus, Star, Briefcase, CalendarX } from 'lucide-react'
import { formatDateOnly } from '@/lib/format'
import DonutChart from '@/components/DonutChart'
import NpsTrendChart from '@/components/admin/NpsTrendChart'
import OwnerOpsSection from './OwnerOpsSection'
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
    { data: alerts },
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
    supabase.from('user_access')
      .select('id, user_id, status, access_until, profiles(full_name), products(title)')
      .eq('status', 'active')
      .or(`access_until.is.null,access_until.lt.${today}`)
      .order('access_until', { ascending: true })
      .limit(8),
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
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen de la plataforma</p>
        </div>
        <Link href="/admin/clients/create" className="btn-primary">
          <UserPlus size={16} /> Nuevo cliente
        </Link>
      </div>

      {/* KPIs — tarjetas "instrumento": badge de ícono + resplandor ambiental
          detrás, como luces de panel de control (identidad de marca:
          Sabiduría Empresarial = "cabina de control"). */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Activos', value: activeCount ?? 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', glow: '#34d399' },
          { label: 'Inactivos', value: expiredCount ?? 0, icon: TrendingDown, color: 'text-cream-muted', bg: 'bg-surface-700', glow: undefined },
          { label: 'Sin fecha', value: noDateCount ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', urgent: true, glow: '#f87171' },
          { label: 'Vencen en 7d', value: soonCount ?? 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', glow: '#fbbf24' },
          { label: 'Vencen próx. mes', value: soonMonthCount ?? 0, icon: CalendarClock, color: 'text-sky-400', bg: 'bg-sky-500/10', glow: '#38bdf8' },
        ].map(({ label, value, icon: Icon, color, bg, urgent, glow }, i) => (
          <div
            key={label}
            className={`card card-glow animate-fade-up ${urgent && Number(value) > 0 ? 'border-red-500/30' : ''}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {glow && <div className="card-glow-orb" style={{ background: glow }} />}
            <div className={`relative w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={19} className={color} />
            </div>
            <p className={`relative text-3xl font-bold tabular-nums ${urgent && Number(value) > 0 ? 'text-red-400' : 'text-cream'}`}>{value}</p>
            <p className="relative text-xs text-cream-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[0.75fr_1.6fr] gap-4 mb-8">
        {/* Salud de cartera — más secundaria a propósito (pedido de Juan,
            2026-07-07 noche): resumen visual chico de Activos/Inactivos; el
            desglose fino por estado (saludable/riesgo/pausa/bandera) está más
            abajo, solo para owner. NPS Global es el protagonista de esta fila. */}
        <div className="card animate-fade-up" style={{ animationDelay: '240ms' }}>
          <p className="text-xs font-medium text-cream-muted mb-3">Salud de cartera</p>
          <DonutChart
            centerValue={(activeCount ?? 0) + (expiredCount ?? 0)}
            centerLabel="clientes totales"
            size={132}
            thickness={14}
            segments={[
              { label: 'Activos', value: activeCount ?? 0, color: '#34d399' },
              { label: 'Inactivos', value: expiredCount ?? 0, color: '#5b4b3f' },
            ]}
          />
        </div>

        {/* NPS Global — vistazo visual; el desglose por módulo/hiperfoco y el
            filtro de meses viven en /admin/nps (calibración 2026-07-06). */}
        <div className="card card-glow animate-fade-up" style={{ animationDelay: '300ms' }}>
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
            <NpsTrendChart data={npsTrendGlobal} height={170} />
          </div>
        </div>
      </div>

      {/* Resumen de los otros 2 pilares (NPS ya tiene su tarjeta arriba) — un
          KPI por Business Coach (escalable: 1 tarjeta por cada uno, con sus
          clientes asignados) + Clientes en riesgo por asistencia, cada uno
          con su apartado de detalle (calibración 2026-07-07 noche). */}
      {(isOwner || isAdmin) && (
        <div className="flex flex-wrap gap-4 mb-8">
          {isOwner && businessCoaches.map(bc => (
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
            {clientesEnRiesgo.length > 0 && <div className="card-glow-orb opacity-20" style={{ background: '#f87171' }} />}
            <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${clientesEnRiesgo.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              <CalendarX size={19} className={clientesEnRiesgo.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
            </div>
            <div className="relative flex-1 min-w-0">
              <p className={`text-3xl font-bold tabular-nums ${clientesEnRiesgo.length > 0 ? 'text-red-400' : 'text-cream'}`}>{clientesEnRiesgo.length}</p>
              <p className="text-xs text-cream-muted mt-1">En riesgo por asistencia — ver detalle</p>
            </div>
            <ArrowRight size={16} className="relative text-cream-muted shrink-0" />
          </Link>
        </div>
      )}

      {isOwner && <OwnerOpsSection searchParams={searchParams} />}

      {/* Alertas */}
      {alerts && alerts.length > 0 ? (
        <div className="card border-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-sm font-medium text-cream">Requieren atención inmediata</p>
            </div>
            <Link href="/admin/clients" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-surface-700">
            {alerts.map((a: any) => (
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
                  <span className={a.access_until ? 'badge-inactive' : 'badge-warning'}>
                    {a.access_until ? 'Vencido' : 'Sin fecha'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card border-emerald-500/20 text-center py-10">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Users size={20} className="text-emerald-400" />
          </div>
          <p className="text-cream font-medium">Todo en orden</p>
          <p className="text-cream-muted text-sm mt-1">No hay clientes con alertas pendientes</p>
        </div>
      )}

      {/* Vencimientos próximos — predictibilidad de renovaciones (pedido de
          Diana, calibración 2026-07-06), separado de "Requieren atención
          inmediata" (que es sin fecha o ya vencidos). */}
      {soonMonthList && soonMonthList.length > 0 && (
        <div className="card border-sky-500/20 mt-4">
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
