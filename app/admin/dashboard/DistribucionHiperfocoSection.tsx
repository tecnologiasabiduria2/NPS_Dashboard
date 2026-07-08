import { formatMonthLong } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import ProductFilter from './ProductFilter'

// ============================================================================
// DISTRIBUCIÓN POR HIPERFOCO — extraída de OwnerOpsSection y subida arriba en
// el dashboard (pedido de Juan, 2026-07-08: "la distribución por hiperfocos
// debe ir más arriba"). Solo owner (mismo gate que el resto de "Operación y
// salud del negocio"). Nota: OwnerOpsSection.tsx sigue calculando su propia
// copia de esta misma distribución internamente (la necesita para el insight
// "menor NPS del mes") — está duplicado a propósito para no acoplar los dos
// componentes ni arriesgar romper esa sección; a esta escala (beta, pocos
// clientes) el costo de repetir la consulta es insignificante.
// ============================================================================

function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function DistribucionHiperfocoSection({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>
}) {
  const { producto: productoFilter = '' } = await searchParams
  const supabase = await createClient()
  const periodoActual = periodoKey(0)

  const [{ data: activos }, { data: hiperfocos }, { data: uhmMes }, { data: npsRows }] = await Promise.all([
    supabase.from('user_access').select('user_id').eq('status', 'active'),
    supabase.from('hiperfocos').select('id, title, products(slug, title)'),
    supabase.from('user_hiperfoco_mes').select('user_id, estado, hiperfoco_id').eq('periodo', periodoActual),
    supabase.from('nps_responses').select('user_id, score, created_at, hiperfoco_id').gte('created_at', periodoActual),
  ])

  const activeIds = new Set<string>(((activos as any[]) ?? []).map(r => r.user_id))
  const hfTitle = new Map<string, string>(
    ((hiperfocos as any[]) ?? []).map(h => [h.id, h.products?.title ? `${h.title} · ${h.products.title}` : h.title])
  )
  const productOptions = (() => {
    const seen = new Map<string, string>()
    for (const h of (hiperfocos as any[]) ?? []) {
      const slug = h.products?.slug
      if (slug && !seen.has(slug)) seen.set(slug, h.products?.title ?? slug)
    }
    return [...seen.entries()].map(([slug, title]) => ({ slug, title }))
  })()
  const allowedHfIds = new Set<string>(
    ((hiperfocos as any[]) ?? [])
      .filter(h => !productoFilter || h.products?.slug === productoFilter)
      .map(h => h.id as string)
  )
  const inScope = (hiperfocoId: string | null) => !!hiperfocoId && allowedHfIds.has(hiperfocoId)

  const estadoActual = new Map<string, { estado: string; hiperfoco_id: string | null }>()
  for (const row of (uhmMes as any[]) ?? []) {
    if (!activeIds.has(row.user_id)) continue
    estadoActual.set(row.user_id, { estado: row.estado, hiperfoco_id: row.hiperfoco_id })
  }

  const distrib = new Map<string, { count: number; npsSum: number; npsN: number }>()
  for (const id of activeIds) {
    const cur = estadoActual.get(id)
    if (cur?.estado === 'en_curso' && inScope(cur.hiperfoco_id)) {
      const title = hfTitle.get(cur.hiperfoco_id!) ?? '—'
      const d = distrib.get(title) ?? { count: 0, npsSum: 0, npsN: 0 }
      d.count++
      distrib.set(title, d)
    }
  }
  for (const r of (npsRows as any[]) ?? []) {
    if (String(r.created_at).slice(0, 7) !== periodoActual.slice(0, 7)) continue
    const cur = estadoActual.get(r.user_id)
    if (cur?.estado === 'en_curso' && inScope(cur.hiperfoco_id)) {
      const title = hfTitle.get(cur.hiperfoco_id!) ?? '—'
      const d = distrib.get(title)
      if (d) { d.npsSum += Number(r.score); d.npsN++ }
    }
  }
  const distribTotal = [...distrib.values()].reduce((a, d) => a + d.count, 0)
  const distribList = [...distrib.entries()]
    .map(([title, d]) => ({
      title,
      count: d.count,
      nps: d.npsN ? d.npsSum / d.npsN : null,
      pct: distribTotal ? (d.count / distribTotal) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="card mb-8">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-3">
        <p className="text-sm font-medium text-cream">Distribución por hiperfoco · {formatMonthLong(periodoActual)}</p>
        <div className="flex items-center gap-3">
          <p className="text-xs text-cream-dim">{distribTotal} empresarios</p>
          {productOptions.length > 1 && <ProductFilter options={productOptions} value={productoFilter} />}
        </div>
      </div>
      {distribList.length === 0 ? (
        <p className="text-sm text-cream-muted">Nadie tiene un hiperfoco en curso este mes todavía.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {distribList.map(d => {
            const hue = getHiperfocoVisual(d.title).solid
            return (
              <div key={d.title} className="card-glow bg-surface-800 border border-surface-700 rounded-xl px-4 py-3.5">
                <div className="card-glow-orb opacity-20" style={{ background: hue }} />
                <p className="relative text-sm text-cream font-medium truncate mb-2">{d.title}</p>
                {/* Conteo de empresarios + NPS priorizados (pedido de Juan,
                    2026-07-09): números grandes, mismo lenguaje que los KPI del
                    dashboard — la barra baja a un rol secundario/decorativo. */}
                <div className="relative flex items-end justify-between gap-3 mb-2">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-cream leading-none">{d.count}</p>
                    <p className="text-xs text-cream-muted mt-1">empresario{d.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-cream-muted mb-1">NPS</p>
                    <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: 'rgba(234,173,116,0.9)' }}>
                      {d.nps !== null ? d.nps.toFixed(1) : '—'}
                    </p>
                  </div>
                </div>
                <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(38,28,33,0.2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.pct.toFixed(1)}%`, background: 'linear-gradient(90deg, #7e301f, #da7d41)' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
