import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, Users, TrendingDown, Clock, ArrowRight, UserPlus } from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: activeCount },
    { count: expiredCount },
    { count: noDateCount },
    { count: soonCount },
    { data: alerts },
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
  ])

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Activos', value: activeCount ?? 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Inactivos', value: expiredCount ?? 0, icon: TrendingDown, color: 'text-cream-muted', bg: 'bg-surface-700' },
          { label: 'Sin fecha', value: noDateCount ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', urgent: true },
          { label: 'Vencen en 7d', value: soonCount ?? 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg, urgent }) => (
          <div key={label} className={`card ${urgent && Number(value) > 0 ? 'border-red-500/30' : ''}`}>
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`text-3xl font-bold ${urgent && Number(value) > 0 ? 'text-red-400' : 'text-cream'}`}>{value}</p>
            <p className="text-xs text-cream-muted mt-1">{label}</p>
          </div>
        ))}
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
