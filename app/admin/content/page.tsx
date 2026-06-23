import { createClient } from '@/lib/supabase/server'
import LessonForm from './LessonForm'

export default async function ContentPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, title, slug, order, modules(id, title, order, is_published, lessons(id, title, type, fathom_share_id, storage_path, order, is_published))')
    .order('order')

  // Aplanar módulos (para el selector) y mapear lecciones por módulo (para edición)
  const modules: { id: string; label: string }[] = []
  const lessonsByModule: Record<string, any[]> = {}
  for (const product of (products ?? []) as any[]) {
    const mods = [...(product.modules ?? [])].sort((a: any, b: any) => a.order - b.order)
    for (const mod of mods) {
      modules.push({ id: mod.id, label: `${product.title} · ${mod.order}. ${mod.title}` })
      lessonsByModule[mod.id] = [...(mod.lessons ?? [])].sort((a: any, b: any) => a.order - b.order)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-cream">Gestión de contenido</h1>
        <p className="text-xs text-cream-muted">Carga y edición desde la plataforma</p>
      </div>

      {/* Panel de carga/edición (A6) */}
      <LessonForm modules={modules} lessonsByModule={lessonsByModule} />

      {/* Listado existente (solo lectura) */}
      <div className="space-y-6">
        {(products ?? []).map((product: any) => (
          <div key={product.id} className="card">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">{product.title}</h2>
            <div className="space-y-2">
              {(product.modules as any[]).sort((a: any, b: any) => a.order - b.order).map((mod: any) => (
                <div key={mod.id} className="flex items-center justify-between bg-surface-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm text-zinc-200">{mod.order}. {mod.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{(mod.lessons as any[]).length} lecciones</p>
                  </div>
                  <span className={mod.is_published ? 'badge-active' : 'badge-pending'}>
                    {mod.is_published ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
              ))}
              {(product.modules as any[]).length === 0 && (
                <p className="text-sm text-zinc-600 text-center py-4">Sin módulos aún</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
