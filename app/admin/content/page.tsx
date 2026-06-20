import { createClient } from '@/lib/supabase/server'

export default async function ContentPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, title, slug, order, modules(id, title, order, is_published, lessons(id, title, type))')
    .order('order')

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Gestión de contenido</h1>
        <p className="text-xs text-zinc-500">v1 — edición completa en v2</p>
      </div>
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
