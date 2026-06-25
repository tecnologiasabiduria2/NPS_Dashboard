import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Video, FileText } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'

// Primer día del mes actual como 'YYYY-MM-DD', sin depender de TZ del cliente.
function periodoActual(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

const TRANSVERSAL_TITLES = ['Sala de Gerencia', 'Entrenamiento Comercial'] as const

export default async function MiContenidoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: access } = await supabase
    .from('user_access')
    .select('product_id, products(title)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!access) redirect('/access-expired')

  const productId: string = (access as any).product_id
  const periodo = periodoActual()

  const [
    { data: historialRaw },
    { data: modulesRaw },
    { data: transversalesRaw },
  ] = await Promise.all([
    // Historial de hiperfocos del usuario (B12), desc por periodo
    supabase
      .from('user_hiperfoco_mes')
      .select('periodo, hiperfoco_id, hiperfocos(id, title)')
      .eq('user_id', user.id)
      .not('hiperfoco_id', 'is', null)
      .order('periodo', { ascending: false }),
    // Módulos publicados del producto
    supabase
      .from('modules')
      .select('id, title, order, hiperfoco_id, lessons(id, type)')
      .eq('product_id', productId)
      .eq('is_published', true)
      .order('order'),
    // Hiperfocos transversales del producto
    supabase
      .from('hiperfocos')
      .select('id, title')
      .eq('product_id', productId)
      .in('title', [...TRANSVERSAL_TITLES])
      .eq('is_active', true),
  ])

  const historial = (historialRaw as any[]) ?? []
  const allModules = (modulesRaw as any[]) ?? []
  const transversales = (transversalesRaw as any[]) ?? []

  // IDs accesibles según historial (B12: acumulativos) y transversales
  const accessibleIds = new Set<string>(historial.map((h: any) => h.hiperfoco_id))
  const transversalIds = new Set<string>(transversales.map((h: any) => h.id))
  const freeAccess = accessibleIds.size === 0 // sin historial → catálogo libre

  // Módulos agrupados por hiperfoco_id (solo los que el usuario puede ver)
  const modulesByHiperfoco = new Map<string, any[]>()
  for (const mod of allModules) {
    if (!mod.hiperfoco_id) continue
    const accessible =
      freeAccess ||
      accessibleIds.has(mod.hiperfoco_id) ||
      transversalIds.has(mod.hiperfoco_id)
    if (!accessible) continue
    if (!modulesByHiperfoco.has(mod.hiperfoco_id)) modulesByHiperfoco.set(mod.hiperfoco_id, [])
    modulesByHiperfoco.get(mod.hiperfoco_id)!.push(mod)
  }

  // Hiperfoco del mes actual
  const mesActual = historial.find((h: any) => h.periodo === periodo)
  const currentHiperfocoId: string | null = mesActual?.hiperfoco_id ?? null

  // Hiperfocos anteriores únicos (sin repetir el del mes actual ni los transversales)
  const pastSeen = new Set<string>()
  if (currentHiperfocoId) pastSeen.add(currentHiperfocoId)
  for (const id of transversalIds) pastSeen.add(id)

  const pastHiperfocos: Array<{ id: string; title: string }> = []
  for (const h of historial) {
    if (pastSeen.has(h.hiperfoco_id)) continue
    pastSeen.add(h.hiperfoco_id)
    pastHiperfocos.push({ id: h.hiperfoco_id, title: (h.hiperfocos as any)?.title ?? '' })
  }

  const productTitle = (access as any)?.products?.title ?? ''

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <p className="text-cream-muted text-sm">{productTitle}</p>
        <h1 className="page-title mt-1">Mi contenido</h1>
      </div>

      {/* Este mes */}
      {currentHiperfocoId && (
        <section className="mb-8">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
            Este mes · <span className="capitalize">{formatMonthLong(periodo)}</span>
          </p>
          <HiperfocoBlock
            title={(mesActual?.hiperfocos as any)?.title ?? ''}
            modules={modulesByHiperfoco.get(currentHiperfocoId) ?? []}
            highlighted
          />
        </section>
      )}

      {/* Catálogo libre (sin historial de asignación) */}
      {freeAccess && allModules.filter((m: any) => !transversalIds.has(m.hiperfoco_id)).length > 0 && (
        <section className="mb-8">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Explorar catálogo</p>
          <div className="space-y-2">
            {allModules
              .filter((m: any) => m.hiperfoco_id && !transversalIds.has(m.hiperfoco_id))
              .map((mod: any) => <ModuleCard key={mod.id} mod={mod} />)}
          </div>
        </section>
      )}

      {/* Hiperfocos anteriores accesibles (B12) */}
      {pastHiperfocos.length > 0 && (
        <section className="mb-8">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Hiperfocos anteriores</p>
          <div className="space-y-4">
            {pastHiperfocos.map(h => (
              <HiperfocoBlock
                key={h.id}
                title={h.title}
                modules={modulesByHiperfoco.get(h.id) ?? []}
              />
            ))}
          </div>
        </section>
      )}

      {/* Contenido transversal (siempre visible) */}
      {TRANSVERSAL_TITLES.map(name => {
        const hiper = transversales.find((h: any) => h.title === name)
        const mods = hiper ? (modulesByHiperfoco.get(hiper.id) ?? []) : []
        return (
          <section key={name} className="mb-8">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{name}</p>
            {mods.length > 0 ? (
              <div className="space-y-2">
                {mods.map((mod: any) => <ModuleCard key={mod.id} mod={mod} />)}
              </div>
            ) : (
              <div className="card py-6 text-center">
                <p className="text-sm text-zinc-600">Contenido próximamente</p>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function HiperfocoBlock({
  title,
  modules,
  highlighted = false,
}: {
  title: string
  modules: any[]
  highlighted?: boolean
}) {
  return (
    <div className={`card ${highlighted ? 'border-brand-600/40 bg-surface-800' : ''}`}>
      <p className={`text-sm font-semibold mb-3 ${highlighted ? 'text-brand-400' : 'text-zinc-300'}`}>
        {title || '—'}
      </p>
      {modules.length > 0 ? (
        <div className="space-y-2">
          {modules.map((mod: any) => <ModuleCard key={mod.id} mod={mod} />)}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">Sin grabaciones publicadas aún.</p>
      )}
    </div>
  )
}

function ModuleCard({ mod }: { mod: any }) {
  const lessons = (mod.lessons as any[]) ?? []
  const videoCount = lessons.filter((l: any) => l.type === 'video').length
  const docCount = lessons.filter((l: any) => l.type === 'document').length

  return (
    <Link
      href={`/module/${mod.id}`}
      className="flex items-center justify-between px-4 py-3 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 group-hover:text-zinc-100 truncate">{mod.title}</p>
        <div className="flex items-center gap-3 mt-1">
          {videoCount > 0 && (
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Video size={11} /> {videoCount}
            </span>
          )}
          {docCount > 0 && (
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <FileText size={11} /> {docCount}
            </span>
          )}
          {videoCount === 0 && docCount === 0 && (
            <span className="text-xs text-zinc-600">Sin grabaciones</span>
          )}
        </div>
      </div>
      <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 ml-3 transition-colors" />
    </Link>
  )
}
