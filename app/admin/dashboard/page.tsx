import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, Users, TrendingDown, Clock, ArrowRight, UserPlus, Star } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import DonutChart from '@/components/DonutChart'

function npsColorClass(score: number) {
  if (score >= 8) return 'text-emerald-400'
  if (score >= 6) return 'text-amber-400'
  return 'text-red-400'
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const periodoActual = `${today.slice(0, 7)}-01`

  const [
    { count: activeCount },
    { count: expiredCount },
    { count: noDateCount },
    { count: soonCount },
    { data: alerts },
    { data: npsMesRaw },
  ] = await Promise.all([
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active').is('access_until', null),
    supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('status', 'active').lte('access_until', soonDate).gte('access_until', today),
    supabase.from('user_access')
      .select('id, user_id, status, access_until, profiles(full_name), products(title)')
      .eq('status', 'active')
      .or(`access_until.is.null,access_until.lt.${today}`)
      .order('access_until', { ascending: true })
      .limit(8),
    // NPS del mes en curso, por hiperfoco — resumen simple (el detalle completo vive en /admin/360).
    supabase
      .from('nps_responses')
      .select('score, hiperfocos(title)')
      .gte('created_at', periodoActual)
      .not('hiperfoco_id', 'is', null),
  ])

  const npsByHf = new Map<string, { sum: number; count: number }>()
  for (const r of (npsMesRaw ?? []) as any[]) {
    const title = (Array.isArray(r.hiperfocos) ? r.hiperfocos[0]?.title : r.hiperfocos?.title) ?? 'Sin hiperfoco'
    const d = npsByHf.get(title) ?? { sum: 0, count: 0 }
    d.sum += r.score
    d.count++
    npsByHf.set(title, d)
  }
  const npsList = [...npsByHf.entries()]
    .map(([title, d]) => ({ title, avg: Math.round((d.sum / d.count) * 10) / 10, count: d.count }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen de la plataforma</p>
        </div>
        <Link href="/admin/clients/create" className="btn-primary">
          <UserPlus size={16} /> Nuevo cliente
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Activos', value: activeCount ?? 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Inactivos', value: expiredCount ?? 0, icon: TrendingDown, color: 'text-cream-muted', bg: 'bg-surface-700' },
          { label: 'Sin fecha', value: noDateCount ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', urgent: true },
          { label: 'Vencen en 7d', value: soonCount ?? 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg, urgent }, i) => (
          <div
            key={label}
            className={`card animate-fade-up ${urgent && Number(value) > 0 ? 'border-red-500/30' : ''}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`text-3xl font-bold ${urgent && Number(value) > 0 ? 'text-red-400' : 'text-cream'}`}>{value}</p>
            <p className="text-xs text-cream-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        {/* Salud de cartera — resumen visual (el desglose fino vive en /admin/360) */}
        <div className="card animate-fade-up" style={{ animationDelay: '240ms' }}>
          <p className="text-sm font-medium text-cream mb-4">Salud de cartera</p>
          <DonutChart
            centerValue={(activeCount ?? 0) + (expiredCount ?? 0)}
            centerLabel="clientes totales"
            segments={[
              { label: 'Activos', value: activeCount ?? 0, color: '#34d399' },
              { label: 'Inactivos', value: expiredCount ?? 0, color: '#4e4a64' },
            ]}
          />
        </div>

        {/* NPS por módulo (resumen simple; el detalle completo está en /admin/360) */}
        <div className="card animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-400" />
              <p className="text-sm font-medium text-cream">NPS por módulo · {formatMonthLong(periodoActual)}</p>
            </div>
            <Link href="/admin/360" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Ver detalle <ArrowRight size={12} />
            </Link>
          </div>
          {npsList.length === 0 ? (
            <p className="text-sm text-cream-muted text-center py-4">Sin respuestas de NPS este mes todavía.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {npsList.map(row => {
                const visual = getHiperfocoVisual(row.title)
                const HfIcon = visual.icon
                return (
                  <div key={row.title} className="bg-surface-800 rounded-xl px-3 py-3 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `linear-gradient(135deg, ${visual.from}, ${visual.to})` }}
                    >
                      <HfIcon size={14} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-cream-muted truncate">{row.title}</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className={`text-lg font-bold ${npsColorClass(row.avg)}`}>{row.avg}</p>
                        <p className="text-xs text-cream-muted">({row.count})</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

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
    </div>
  )
}
