import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatMonthLong } from '@/lib/format'
import ContentCards, { type ContentCard } from './ContentCards'

function periodoActual(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial'] as const

export default async function MiContenidoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Nota: un cliente puede tener más de un producto activo (el shell soporta
  // varios en el riel). Tomamos el primero para el contenido de Aprendizaje —
  // NO usar .single() aquí: con 2+ accesos lanza error y rompía la página.
  const { data: accessRows } = await supabase
    .from('user_access')
    .select('product_id, products(title)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)

  const access = accessRows?.[0]
  if (!access) redirect('/access-expired')

  const productId: string = (access as any).product_id
  const periodo = periodoActual()

  const [{ data: historialRaw }, { data: allProdHfs }] = await Promise.all([
    supabase
      .from('user_hiperfoco_mes')
      .select('periodo, hiperfoco_id, hiperfocos(id, title)')
      .eq('user_id', user.id)
      .not('hiperfoco_id', 'is', null)
      .order('periodo', { ascending: false }),
    supabase.from('hiperfocos').select('id, title').eq('product_id', productId).eq('is_active', true),
  ])

  const historial = (historialRaw ?? []) as any[]
  const accessibleIds = new Set<string>(historial.map((h: any) => h.hiperfoco_id))
  const allProdHfList = (allProdHfs ?? []) as { id: string; title: string }[]
  const allProdHfIds = allProdHfList.map(h => h.id)
  const freeAccess = accessibleIds.size === 0

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

  const mainByHf = new Map<string, any[]>()
  for (const r of mainRecsRaw ?? []) {
    if (!mainByHf.has(r.hiperfoco_id)) mainByHf.set(r.hiperfoco_id, [])
    mainByHf.get(r.hiperfoco_id)!.push(r)
  }
  const allTransversal = (transversalRecsRaw ?? []) as any[]
  const sgRecs = allTransversal.filter(r => r.tipo === 'sala_gerencia')
  const ecRecs = allTransversal.filter(r => r.tipo === 'entrenamiento_comercial')

  // Progreso: grabaciones completadas por el usuario (para las barras de las cards)
  const allRecIds = [
    ...(mainRecsRaw ?? []).map((r: any) => r.id),
    ...allTransversal.map((r: any) => r.id),
  ]
  let completedSet = new Set<string>()
  if (allRecIds.length > 0) {
    const { data: progress } = await supabase
      .from('recording_progress')
      .select('recording_id')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('recording_id', allRecIds)
    completedSet = new Set((progress ?? []).map((p: any) => p.recording_id))
  }

  const toCardRecs = (recs: any[]) => recs.map(r => ({ id: r.id, title: r.title, type: r.type }))
  const countDone = (recs: any[]) => recs.filter(r => completedSet.has(r.id)).length

  // Armar cards: hiperfoco del mes (destacado) → anteriores (B12) → SG → EC
  const cards: ContentCard[] = []

  const mesActual = historial.find((h: any) => h.periodo === periodo)
  const currentId: string | null = mesActual?.hiperfoco_id ?? null
  const seen = new Set<string>()
  if (currentId) {
    seen.add(currentId)
    const recs = mainByHf.get(currentId) ?? []
    cards.push({
      key: currentId,
      title: (mesActual?.hiperfocos as any)?.title ?? '',
      badge: `Este mes · ${formatMonthLong(periodo)}`,
      recordings: toCardRecs(recs),
      completed: countDone(recs),
      total: recs.length,
      highlighted: true,
    })
  }
  for (const h of historial) {
    if (seen.has(h.hiperfoco_id)) continue
    seen.add(h.hiperfoco_id)
    const recs = mainByHf.get(h.hiperfoco_id) ?? []
    cards.push({
      key: h.hiperfoco_id,
      title: (h.hiperfocos as any)?.title ?? '',
      recordings: toCardRecs(recs),
      completed: countDone(recs),
      total: recs.length,
    })
  }
  // Hiperfocos del producto que aún NO le han asignado → se muestran pero BLOQUEADOS.
  // Regla (decisión 2026-07-01): solo el hiperfoco en curso + los ya cerrados están
  // accesibles; el resto se desbloquea al terminar el actual / cuando el Business
  // Coach lo asigne. El acceso real ya lo impone /recording/[id] (mira las asignaciones).
  for (const h of allProdHfList) {
    if (seen.has(h.id)) continue
    seen.add(h.id)
    cards.push({ key: h.id, title: h.title ?? '', recordings: [], completed: 0, total: 0, locked: true })
  }

  // Transversales (siempre visibles, aunque estén vacías)
  cards.push({ key: 'sg', title: 'Sala de Gerencia', recordings: toCardRecs(sgRecs), completed: countDone(sgRecs), total: sgRecs.length })
  cards.push({ key: 'ec', title: 'Entrenamiento Comercial', recordings: toCardRecs(ecRecs), completed: countDone(ecRecs), total: ecRecs.length })

  const productTitle = (access as any)?.products?.title ?? ''

  return (
    <div>
      <div className="mb-8">
        <p className="text-cream-muted text-sm">{productTitle}</p>
        <h1 className="page-title mt-1">Aprendizaje</h1>
        <p className="page-subtitle">Tus clases, inmersiones y mentorías.</p>
      </div>

      {freeAccess && (
        <div className="card py-10 text-center mb-6">
          <p className="text-cream font-medium mb-2">Aún no tienes contenido asignado</p>
          <p className="text-sm text-cream-muted">Solicita tu hiperfoco a tu Business Coach para comenzar.</p>
        </div>
      )}

      <ContentCards cards={cards} />
    </div>
  )
}
