import { createClient } from '@/lib/supabase/server'
import { CONTENT_TIPOS, contentTipoLabel } from '@/lib/sessionTypes'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import LessonForm, { type HiperfocoConTipos } from './LessonForm'

// Transversales: comparten los 3 productos, no pertenecen a un hiperfoco
// especifico aunque la fila en `recordings` tenga que colgarse de alguno por
// la FK (corregido 2026-07-09) — se muestran en su propia seccion, sacadas
// del anidado Producto -> Hiperfoco de abajo para no confundir a quien sube
// contenido pensando que quedo restringido a ese producto/hiperfoco.
const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial']

export default async function ContentPage() {
  const supabase = await createClient()

  // Tres queries independientes: si recordings aún no existe (migración pendiente),
  // los hiperfocos y productos siguen cargando y el formulario funciona.
  const [{ data: products }, { data: hiperfocos }, { data: recordingsRaw }] = await Promise.all([
    supabase.from('products').select('id, title, slug, order').order('order'),
    supabase.from('hiperfocos').select('id, title, product_id').eq('is_active', true).order('order'),
    supabase.from('recordings').select('id, hiperfoco_id, title, type, fathom_share_id, storage_path, order, is_published, tipo'),
  ])

  const recordings = (recordingsRaw ?? []) as any[]
  const productList = ((products ?? []) as any[]).map(p => ({ id: p.id, title: p.title }))

  // Construir mapa hiperfoco → tipos → grabaciones (sin depender de join anidado).
  // Completo (los 4 tipos) — este es el que necesita LessonForm para poder
  // subir/editar Sala de Gerencia y Entrenamiento Comercial igual que siempre.
  const hiperfocoData: HiperfocoConTipos[] = ((hiperfocos ?? []) as any[]).map(h => ({
    id: h.id,
    title: h.title,
    product_id: h.product_id,
    tipos: CONTENT_TIPOS.map(ct => ({
      tipo: ct.value,
      recordings: recordings
        .filter(r => r.hiperfoco_id === h.id && r.tipo === ct.value)
        .sort((a: any, b: any) => a.order - b.order),
    })),
  }))

  // Variante SOLO para el listado de abajo: sin los tipos transversales (esos
  // van en su propia sección global, no anidados bajo un hiperfoco/producto
  // puntual que no refleja dónde realmente se ven).
  const hiperfocoDataForListing: HiperfocoConTipos[] = hiperfocoData.map(h => ({
    ...h,
    tipos: h.tipos.filter(t => !TRANSVERSAL_TIPOS.includes(t.tipo)),
  }))

  // Sección transversal: todas las grabaciones de estos 2 tipos, de cualquier
  // hiperfoco/producto, en una sola lista por tipo — refleja que se ven en
  // los 3 productos, no solo en el que quedaron colgadas. Sin filtrar vacíos
  // (LessonForm necesita las 2 entradas siempre, aunque no tengan nada aún).
  const transversalDataFull = CONTENT_TIPOS
    .filter(ct => TRANSVERSAL_TIPOS.includes(ct.value))
    .map(ct => ({
      tipo: ct.value,
      recordings: recordings.filter(r => r.tipo === ct.value).sort((a: any, b: any) => a.order - b.order),
    }))
  const transversalData = transversalDataFull.filter(t => t.recordings.length > 0)

  // Agrupar hiperfocos por producto para el listado inferior
  const hiperfocosByProduct = new Map<string, HiperfocoConTipos[]>()
  for (const h of hiperfocoDataForListing) {
    if (!hiperfocosByProduct.has(h.product_id)) hiperfocosByProduct.set(h.product_id, [])
    hiperfocosByProduct.get(h.product_id)!.push(h)
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="page-title">Gestión de contenido</h1>
        <p className="text-xs text-cream-muted">Carga y edición desde la plataforma</p>
      </div>

      <LessonForm products={productList} hiperfocos={hiperfocoData} transversal={transversalDataFull} />

      {/* Transversal — Sala de Gerencia/Entrenamiento Comercial, comparten los
          3 productos, no un hiperfoco/producto puntual. */}
      {transversalData.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-cream mb-1">Transversal</h2>
          <p className="text-xs text-cream-muted mb-4">Visible para los 3 productos, sin importar el hiperfoco del cliente</p>
          <div className="space-y-2">
            {transversalData.map(t => (
              <div key={t.tipo} className="bg-surface-800 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-cream">{contentTipoLabel(t.tipo)}</p>
                  <span className="text-xs text-cream-muted">{t.recordings.length} grabación{t.recordings.length !== 1 ? 'es' : ''}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {t.recordings.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-cream-muted">
                      <span>{r.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="uppercase">{r.type}</span>
                        <span className={r.is_published ? 'text-emerald-400' : 'text-cream-muted'}>
                          {r.is_published ? '● Publicada' : '○ Borrador'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listado existente — Producto → Hiperfoco → Tipo → Grabaciones */}
      <div className="space-y-8">
        {((products ?? []) as any[]).map((product, i) => {
          const hfs = hiperfocosByProduct.get(product.id) ?? []
          return (
            <div key={product.id} className="card animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <h2 className="text-lg font-semibold text-cream mb-4">{product.title}</h2>
              {hfs.length === 0 ? (
                <p className="text-sm text-cream-muted text-center py-4">Sin hiperfocos activos</p>
              ) : (
                <div className="space-y-5">
                  {hfs.map(h => {
                    const tiposConContenido = h.tipos.filter(t => t.recordings.length > 0)
                    const visual = getHiperfocoVisual(h.title)
                    const HfIcon = visual.icon
                    return (
                      <div key={h.id}>
                        <p className="text-sm font-medium text-cream-dim mb-2 inline-flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: `linear-gradient(135deg, ${visual.from}, ${visual.to})` }}
                          >
                            <HfIcon size={11} className="text-white" />
                          </span>
                          {h.title}
                        </p>
                        {tiposConContenido.length === 0 ? (
                          <p className="text-xs text-cream-muted pl-2">Sin grabaciones</p>
                        ) : (
                          <div className="space-y-2 pl-2">
                            {tiposConContenido.map(t => (
                              <div key={t.tipo} className="bg-surface-800 rounded-lg px-4 py-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-cream">{contentTipoLabel(t.tipo)}</p>
                                  <span className="text-xs text-cream-muted">{t.recordings.length} grabación{t.recordings.length !== 1 ? 'es' : ''}</span>
                                </div>
                                <div className="mt-2 space-y-1">
                                  {t.recordings.map(r => (
                                    <div key={r.id} className="flex items-center justify-between text-xs text-cream-muted">
                                      <span>{r.title}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="uppercase">{r.type}</span>
                                        <span className={r.is_published ? 'text-emerald-400' : 'text-cream-muted'}>
                                          {r.is_published ? '● Publicada' : '○ Borrador'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
