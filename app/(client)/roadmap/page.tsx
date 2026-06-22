import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Circle, Lock, ChevronRight } from 'lucide-react'

export default async function RoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: access } = await supabase
    .from('user_access')
    .select('product_id, current_module_id, products(title)')
    .eq('user_id', user.id).eq('status', 'active').single()

  if (!access) redirect('/access-expired')

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, description, order, lessons(id, type)')
    .eq('product_id', access.product_id)
    .eq('is_published', true)
    .order('order')

  const moduleProgress: Record<string, { completed: number; total: number }> = {}
  for (const mod of modules ?? []) {
    // El progreso cuenta solo entregables (checklist), no videos ni documentos
    const ids = (mod.lessons as any[]).filter((l: any) => l.type === 'checklist_item').map((l: any) => l.id)
    if (ids.length === 0) { moduleProgress[mod.id] = { completed: 0, total: 0 }; continue }
    const { count } = await supabase
      .from('lesson_progress').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('completed', true).in('lesson_id', ids)
    moduleProgress[mod.id] = { completed: count ?? 0, total: ids.length }
  }

  const productTitle = (access as any)?.products?.title ?? ''
  let firstIncompleteFound = false

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="text-cream-muted text-sm">{productTitle}</p>
        <h1 className="page-title mt-1">Hoja de ruta</h1>
      </div>

      <div className="relative">
        {/* Línea vertical conectora */}
        <div className="absolute left-6 top-6 bottom-6 w-px bg-surface-600" />

        <div className="space-y-3">
          {(modules ?? []).map((mod, index) => {
            const prog = moduleProgress[mod.id] ?? { completed: 0, total: 0 }
            const isComplete = prog.total > 0 && prog.completed === prog.total
            const isCurrent = !isComplete && !firstIncompleteFound
            if (isCurrent) firstIncompleteFound = true
            const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0

            return (
              <Link key={mod.id} href={`/module/${mod.id}`}>
                <div className={`relative ml-12 card hover:border-brand-600/40 transition-all duration-200 cursor-pointer ${isCurrent ? 'border-brand-600/40 bg-surface-800' : ''}`}>
                  {/* Indicador en la línea */}
                  <div className={`absolute -left-9 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center border-2 z-10
                    ${isComplete ? 'bg-emerald-500 border-emerald-500' : isCurrent ? 'bg-brand-600 border-brand-600' : 'bg-surface-850 border-surface-600'}`}>
                    {isComplete
                      ? <CheckCircle2 size={12} className="text-white" />
                      : isCurrent
                        ? <div className="w-2 h-2 rounded-full bg-white" />
                        : <div className="w-2 h-2 rounded-full bg-surface-500" />
                    }
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-cream-muted">Módulo {mod.order}</span>
                        {isCurrent && <span className="badge-brand">En progreso</span>}
                        {isComplete && <span className="badge-active">Completado</span>}
                      </div>
                      <p className="text-cream font-medium">{mod.title}</p>
                      {mod.description && (
                        <p className="text-cream-muted text-xs mt-1 line-clamp-1">{mod.description}</p>
                      )}
                      {prog.total > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-cream-muted mb-1">
                            <span>{prog.completed}/{prog.total} entregables</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-surface-700 rounded-full h-1">
                            <div className="bg-brand-600 h-1 rounded-full transition-all"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-cream-muted shrink-0 mt-1 ml-3" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
