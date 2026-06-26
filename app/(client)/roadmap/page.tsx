import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Video, FileText } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import { CONTENT_TIPOS } from '@/lib/sessionTypes'

function periodoActual(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

// Tipos que se muestran en secciones transversales (no dentro del bloque de hiperfoco)
const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial'] as const

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

  // Fase 1: historial B12 + todos los hiperfocos activos del producto (para transversales)
  const [{ data: historialRaw }, { data: allProdHfs }] = await Promise.all([
    supabase
      .from('user_hiperfoco_mes')
      .select('periodo, hiperfoco_id, hiperfocos(id, title)')
      .eq('user_id', user.id)
      .not('hiperfoco_id', 'is', null)
      .order('periodo', { ascending: false }),
    supabase
      .from('hiperfocos')
      .select('id')
      .eq('product_id', productId)
      .eq('is_active', true),
  ])

  const historial = (historialRaw ?? []) as any[]
  const accessibleIds = new Set<string>(historial.map((h: any) => h.hiperfoco_id))
  const allProdHfIds = (allProdHfs ?? []).map((h: any) => h.id as string)
  const freeAccess = accessibleIds.size === 0

  // Fase 2: grabaciones principales (inmersión/mentoría) para hiperfocos accesibles
  //         + grabaciones transversales (SG/EC) de todos los hiperfocos del producto
  const [{ data: mainRecsRaw }, { data: transversalRecsRaw }] = await Promise.all([
    accessibleIds.size > 0
      ? supabase
          .from('recordings')
          .select('id, hiperfoco_id, tipo, title, type')
          .in('hiperfoco_id', [...accessibleIds])
          .in('tipo', ['inmersion', 'mentoria'])
          .eq('is_published', true)
          .order('order')
      : Promise.resolve({ data: [] as any[] }),
    allProdHfIds.length > 0
      ? supabase
          .from('recordings')
          .select('id, hiperfoco_id, tipo, title, type')
          .in('hiperfoco_id', allProdHfIds)
          .in('tipo', [...TRANSVERSAL_TIPOS])
          .eq('is_published', true)
          .order('order')
      : Promise.resolve({ data: [] as any[] }),
  ])

  const mainRecordingsByHiperfoco = new Map<string, any[]>()
  for (const r of mainRecsRaw ?? []) {
    if (!mainRecordingsByHiperfoco.has(r.hiperfoco_id))
      mainRecordingsByHiperfoco.set(r.hiperfoco_id, [])
    mainRecordingsByHiperfoco.get(r.hiperfoco_id)!.push(r)
  }

  const allTransversal = (transversalRecsRaw ?? []) as any[]
  const sgRecs = allTransversal.filter(r => r.tipo === 'sala_gerencia')
  const ecRecs = allTransversal.filter(r => r.tipo === 'entrenamiento_comercial')

  // Hiperfoco del mes actual
  const mesActual = historial.find((h: any) => h.periodo === periodo)
  const currentHiperfocoId: string | null = mesActual?.hiperfoco_id ?? null

  // Hiperfocos anteriores (B12 acumulativo, sin el actual)
  const pastSeen = new Set<string>()
  if (currentHiperfocoId) pastSeen.add(currentHiperfocoId)

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

      {/* Sin hiperfoco asignado */}
      {freeAccess && (
        <section className="mb-8">
          <div className="card py-10 text-center">
            <p className="text-cream font-medium mb-2">Aún no tienes contenido asignado</p>
            <p className="text-sm text-cream-muted">Solicita tu hiperfoco a tu asesor comercial para comenzar.</p>
          </div>
        </section>
      )}

      {/* Hiperfoco del mes actual */}
      {currentHiperfocoId && (
        <section className="mb-8">
          <p className="text-xs text-cream-muted uppercase tracking-wider mb-3">
            Este mes · <span className="capitalize">{formatMonthLong(periodo)}</span>
          </p>
          <HiperfocoBlock
            title={(mesActual?.hiperfocos as any)?.title ?? ''}
            recordings={mainRecordingsByHiperfoco.get(currentHiperfocoId) ?? []}
            highlighted
          />
        </section>
      )}

      {/* Hiperfocos anteriores accesibles (B12) */}
      {pastHiperfocos.length > 0 && (
        <section className="mb-8">
          <p className="text-xs text-cream-muted uppercase tracking-wider mb-3">Hiperfocos anteriores</p>
          <div className="space-y-4">
            {pastHiperfocos.map(h => (
              <HiperfocoBlock
                key={h.id}
                title={h.title}
                recordings={mainRecordingsByHiperfoco.get(h.id) ?? []}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sala de Gerencia — transversal */}
      <section className="mb-8">
        <p className="text-xs text-cream-muted uppercase tracking-wider mb-3">Sala de Gerencia</p>
        {sgRecs.length > 0 ? (
          <div className="card">
            <RecordingsList recordings={sgRecs} />
          </div>
        ) : (
          <div className="card py-6 text-center">
            <p className="text-sm text-cream-muted">Contenido próximamente</p>
          </div>
        )}
      </section>

      {/* Entrenamiento Comercial — transversal */}
      <section className="mb-8">
        <p className="text-xs text-cream-muted uppercase tracking-wider mb-3">Entrenamiento Comercial</p>
        {ecRecs.length > 0 ? (
          <div className="card">
            <RecordingsList recordings={ecRecs} />
          </div>
        ) : (
          <div className="card py-6 text-center">
            <p className="text-sm text-cream-muted">Contenido próximamente</p>
          </div>
        )}
      </section>
    </div>
  )
}

function HiperfocoBlock({
  title,
  recordings,
  highlighted = false,
}: {
  title: string
  recordings: any[]
  highlighted?: boolean
}) {
  const tipoMap = new Map<string, any[]>()
  for (const r of recordings) {
    if (!tipoMap.has(r.tipo)) tipoMap.set(r.tipo, [])
    tipoMap.get(r.tipo)!.push(r)
  }

  // Solo mostrar tipos principales (inmersión y mentoría) en el bloque de hiperfoco
  const mainTipos = CONTENT_TIPOS.filter(ct => !['sala_gerencia', 'entrenamiento_comercial'].includes(ct.value))

  return (
    <div className={`card ${highlighted ? 'border-brand-600/40 bg-surface-800' : ''}`}>
      <p className={`text-sm font-semibold mb-3 ${highlighted ? 'text-brand-400' : 'text-cream-dim'}`}>
        {title || '—'}
      </p>
      {recordings.length > 0 ? (
        <div className="space-y-3">
          {mainTipos.map(ct => {
            const recs = tipoMap.get(ct.value) ?? []
            if (recs.length === 0) return null
            return (
              <div key={ct.value}>
                <p className="text-xs text-cream-muted uppercase tracking-wide mb-1.5">{ct.label}</p>
                <RecordingsList recordings={recs} />
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-cream-muted">Sin grabaciones publicadas aún.</p>
      )}
    </div>
  )
}

function RecordingsList({ recordings }: { recordings: any[] }) {
  return (
    <div className="space-y-1.5">
      {recordings.map((rec: any) => (
        <Link
          key={rec.id}
          href={`/recording/${rec.id}`}
          className="flex items-center gap-3 px-3 py-2.5 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors group"
        >
          <span className="shrink-0 text-cream-muted group-hover:text-accent transition-colors">
            {rec.type === 'video' ? <Video size={14} /> : <FileText size={14} />}
          </span>
          <span className="text-sm text-cream-dim group-hover:text-cream flex-1 min-w-0 truncate">{rec.title}</span>
          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
        </Link>
      ))}
    </div>
  )
}
