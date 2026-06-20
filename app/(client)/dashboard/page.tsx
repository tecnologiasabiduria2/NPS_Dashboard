import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowRight, BookOpen, Clock, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: access }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('user_access')
      .select('*, products(title, slug), modules(title, order)')
      .eq('user_id', user.id).eq('status', 'active').single(),
  ])

  let completedCount = 0, totalCount = 0
  if (access?.product_id) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, modules!inner(product_id)')
      .eq('modules.product_id', access.product_id)
      .eq('is_published', true)
    totalCount = lessons?.length ?? 0
    const ids = lessons?.map(l => l.id) ?? []
    if (ids.length > 0) {
      const { count } = await supabase
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('completed', true).in('lesson_id', ids)
      completedCount = count ?? 0
    }
  }

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Bienvenido'
  const productTitle = (access as any)?.products?.title ?? ''
  const currentModule = (access as any)?.modules?.title ?? 'Sin módulo asignado'
  const lastActivity = access?.last_activity
    ? formatDistanceToNow(new Date(access.last_activity), { addSuffix: true, locale: es })
    : null

  return (
    <div className="max-w-4xl">
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
                {new Date(access.access_until).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progreso hero */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #1A1215 0%, #221518 100%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-label">Progreso general</p>
            <p className="text-4xl font-bold text-cream">{progressPercent}<span className="text-xl text-cream-muted">%</span></p>
          </div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `conic-gradient(#9B2C2C ${progressPercent * 3.6}deg, #2E2028 0deg)` }}>
            <div className="w-12 h-12 rounded-full bg-surface-850 flex items-center justify-center">
              <TrendingUp size={18} className="text-brand-400" />
            </div>
          </div>
        </div>
        <div className="w-full bg-surface-700 rounded-full h-1.5">
          <div className="bg-gradient-to-r from-brand-700 to-brand-500 h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="text-xs text-cream-muted mt-2">{completedCount} de {totalCount} lecciones completadas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600/15 flex items-center justify-center">
              <BookOpen size={14} className="text-brand-400" />
            </div>
            <p className="text-xs text-cream-muted uppercase tracking-wide">Módulo actual</p>
          </div>
          <p className="text-sm font-medium text-cream leading-snug">{currentModule}</p>
          <Link href="/roadmap" className="text-xs text-brand-400 hover:text-brand-300 mt-2 inline-flex items-center gap-1">
            Ver hoja de ruta <ArrowRight size={10} />
          </Link>
        </div>

        <div className="card-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-xs text-cream-muted uppercase tracking-wide">Completadas</p>
          </div>
          <p className="text-2xl font-bold text-cream">{completedCount}</p>
          <p className="text-xs text-cream-muted">de {totalCount} lecciones</p>
        </div>

        <div className="card-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock size={14} className="text-amber-400" />
            </div>
            <p className="text-xs text-cream-muted uppercase tracking-wide">Último acceso</p>
          </div>
          <p className="text-sm font-medium text-cream">{lastActivity ?? 'Hoy'}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-cream font-medium">Continúa donde lo dejaste</p>
          <p className="text-cream-muted text-sm mt-0.5">{currentModule}</p>
        </div>
        <Link href="/roadmap" className="btn-primary">
          Continuar <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
