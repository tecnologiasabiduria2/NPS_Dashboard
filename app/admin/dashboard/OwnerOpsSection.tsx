import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lightbulb, Target, TrendingUp } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import DonutChart from '@/components/DonutChart'
import ProductFilter from './ProductFilter'

// ============================================================================
// OPERACIÓN Y SALUD DEL NEGOCIO — solo owner (Diana). Antes era /admin/360
// completa; se fusionó al Dashboard (calibración 2026-07-06) porque varios
// KPIs quedaban duplicados con el dashboard (activos, NPS general, ventana de
// renovación). Lo operativo de CS (Sesiones 1:1, Mentor por hiperfoco,
// Clientes sin 1:1) vive en /admin/clientes-resumen; el desempeño por
// Business Coach (antes "Salud por CS") vive en /admin/business-coach
// (calibración 2026-07-07 noche). Aquí queda lo de negocio general: KPIs,
// distribución, insights, upsell.
//
// ⚠️ Escala: "Top hiperfocos repetidos" recorre TODO el historial de
// user_hiperfoco_mes en JS. Para el beta actual (pocos clientes) es exacto;
// si el historial supera ~1–2k filas conviene mover esa agregación a una
// vista/RPC en Postgres.
// ============================================================================

// Clave 'YYYY-MM-01' del primer día de un mes (local), desplazando `offset` meses.
function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const EXPECTED_MONTHS = 6 // tiempo esperado por hiperfoco antes de cambiar de tema

export default async function OwnerOpsSection({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>
}) {
  const { producto: productoFilter = '' } = await searchParams
  const supabase = await createClient()

  const periodoActual = periodoKey(0)
  const periodoPrev = periodoKey(-1)

  const [
    { data: activos },
    { data: hiperfocos },
    { data: historia },
    { data: banderas },
    { data: npsRows },
    { data: accesoTodos },
  ] = await Promise.all([
    supabase.from('user_access').select('user_id, access_until, access_started').eq('status', 'active'),
    supabase.from('hiperfocos').select('id, title, is_active, products(slug, title)'),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, periodo, estado, hiperfoco_id')
      .order('user_id', { ascending: true })
      .order('periodo', { ascending: true })
      .limit(2000),
    supabase.from('client_flags').select('user_id').eq('type', 'bandera').eq('status', 'abierta'),
    supabase.from('nps_responses').select('user_id, score, created_at, hiperfoco_id').limit(2000),
    // upsell/multi-producto (calibración 2026-07-06): TODAS las filas de
    // user_access sin filtrar por status, para contar productos distintos
    // por cliente (activos o no).
    supabase.from('user_access').select('user_id, product_id, products(title), profiles(full_name)'),
  ])

  const activeRows = (activos as any[]) ?? []
  const activeIds = new Set<string>(activeRows.map(r => r.user_id))
  const totalActivos = activeIds.size
  // etiqueta = "Título · Producto" para SEPARAR hiperfocos homónimos entre
  // productos (ej. "Marketing · Sabiduría" vs "Marketing · Desafío").
  const hfTitle = new Map<string, string>(
    ((hiperfocos as any[]) ?? []).map(h => [
      h.id,
      h.products?.title ? `${h.title} · ${h.products.title}` : h.title,
    ])
  )

  // Filtro de producto (desplegable): opciones distintas + set de hiperfocos en
  // alcance. Solo afecta las secciones por hiperfoco (distribución/repetidos).
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

  const flaggedIds = new Set<string>(((banderas as any[]) ?? []).map(f => f.user_id).filter((id: string) => activeIds.has(id)))

  // --- Estado por usuario en el mes actual y el anterior -----------------
  const estadoActual = new Map<string, { estado: string; hiperfoco_id: string | null }>()
  const estadoPrev = new Map<string, string>()
  for (const row of (historia as any[]) ?? []) {
    if (!activeIds.has(row.user_id)) continue
    if (row.periodo === periodoActual) estadoActual.set(row.user_id, { estado: row.estado, hiperfoco_id: row.hiperfoco_id })
    else if (row.periodo === periodoPrev) estadoPrev.set(row.user_id, row.estado)
  }
  const eligioEsteMes = (id: string) => estadoActual.get(id)?.estado === 'en_curso'
  const eligioMesPrev = (id: string) => estadoPrev.get(id) === 'en_curso'

  const eligieron = [...activeIds].filter(eligioEsteMes).length
  const sinElegir = totalActivos - eligieron
  // En riesgo = activo sin hiperfoco en curso este mes Y el anterior (2 meses sin elegir).
  const enRiesgoIds = new Set<string>([...activeIds].filter(id => !eligioEsteMes(id) && !eligioMesPrev(id)))
  const dosMesesSinElegir = enRiesgoIds.size

  const npsAll = ((npsRows as any[]) ?? []).map(r => ({ user_id: r.user_id, score: Number(r.score), created_at: String(r.created_at), hiperfoco_id: r.hiperfoco_id as string | null }))

  // --- Distribución por hiperfoco (mes actual) + NPS del mes por hiperfoco
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
  // NPS de este mes atribuido al hiperfoco en curso del cliente.
  for (const r of npsAll) {
    if (r.created_at.slice(0, 7) !== periodoActual.slice(0, 7)) continue
    const cur = estadoActual.get(r.user_id)
    if (cur?.estado === 'en_curso' && inScope(cur.hiperfoco_id)) {
      const title = hfTitle.get(cur.hiperfoco_id!) ?? '—'
      const d = distrib.get(title)
      if (d) { d.npsSum += r.score; d.npsN++ }
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

  // --- Upsell / multi-producto (calibración 2026-07-06) -------------------
  // Cualquier cliente con 2+ productos distintos en user_access (activos o
  // no) cuenta como upsell/multi-producto.
  const accesoPorUsuario = new Map<string, { name: string; products: string[] }>()
  for (const r of (accesoTodos as any[]) ?? []) {
    const entry = accesoPorUsuario.get(r.user_id) ?? { name: r.profiles?.full_name ?? '—', products: [] as string[] }
    if (r.products?.title && !entry.products.includes(r.products.title)) entry.products.push(r.products.title)
    accesoPorUsuario.set(r.user_id, entry)
  }
  const multiProducto = [...accesoPorUsuario.entries()]
    .filter(([, v]) => v.products.length >= 2)
    .map(([userId, v]) => ({ userId, name: v.name, products: v.products }))

  // --- Recorrido del historial por usuario: runs de hiperfoco consecutivo --
  // Para tiempo promedio (insight) y top repetidos (runs >= 2).
  const porUsuario = new Map<string, { periodo: string; hiperfoco_id: string | null }[]>()
  for (const row of (historia as any[]) ?? []) {
    if (!activeIds.has(row.user_id) || !inScope(row.hiperfoco_id)) continue
    const arr = porUsuario.get(row.user_id) ?? []
    arr.push({ periodo: row.periodo, hiperfoco_id: row.hiperfoco_id })
    porUsuario.set(row.user_id, arr)
  }
  const runLens = new Map<string, number[]>()
  const repeaters = new Map<string, Set<string>>()
  const everAssigned = new Map<string, Set<string>>()
  for (const [uid, rows] of porUsuario) {
    let i = 0
    while (i < rows.length) {
      const hid = rows[i].hiperfoco_id!
      let j = i
      while (j + 1 < rows.length && rows[j + 1].hiperfoco_id === hid) j++
      const len = j - i + 1
      const title = hfTitle.get(hid) ?? '—'
      if (!runLens.has(title)) runLens.set(title, [])
      runLens.get(title)!.push(len)
      if (!everAssigned.has(title)) everAssigned.set(title, new Set())
      everAssigned.get(title)!.add(uid)
      if (len >= 2) {
        if (!repeaters.has(title)) repeaters.set(title, new Set())
        repeaters.get(title)!.add(uid)
      }
      i = j + 1
    }
  }
  const tiempoList = [...runLens.entries()]
    .map(([title, lens]) => ({
      title,
      avg: lens.reduce((a, b) => a + b, 0) / lens.length,
    }))
    .sort((a, b) => b.avg - a.avg)
  const repetidosList = [...everAssigned.entries()]
    .map(([title, users]) => {
      const reps = repeaters.get(title)?.size ?? 0
      return {
        title,
        reps,
        pct: users.size ? (reps / users.size) * 100 : 0,
      }
    })
    .sort((a, b) => b.reps - a.reps)

  // --- Estado de la cartera (mutuamente excluyente, por prioridad) --------
  let saludables = 0, banderasAmarillas = 0, enRiesgo = 0, enPausa = 0
  for (const id of activeIds) {
    if (enRiesgoIds.has(id)) enRiesgo++
    else if (flaggedIds.has(id)) banderasAmarillas++
    else if (estadoActual.get(id)?.estado === 'pausa') enPausa++
    else saludables++
  }

  // --- Insights automáticos (reglas sobre los datos reales) --------------
  const insights: { color: string; body: ReactNode }[] = []
  if (sinElegir > 0) {
    insights.push({
      color: '#888780',
      body: (
        <>
          <span className="text-cream font-medium">{sinElegir} empresarios no eligieron hiperfoco</span> este mes
          {dosMesesSinElegir > 0 && <> · {dosMesesSinElegir} llevan 2+ meses sin elegir (riesgo de churn)</>}.{' '}
          <Link href="/admin/clients" className="text-brand-400 font-medium">Ver lista →</Link>
        </>
      ),
    })
  }
  const peorNps = distribList.filter(d => d.nps !== null).sort((a, b) => (a.nps! - b.nps!))[0]
  if (peorNps && peorNps.nps! < 7.5) {
    insights.push({
      color: '#E24B4A',
      body: (
        <>
          <span className="text-cream font-medium">{peorNps.title} tiene el NPS más bajo este mes ({peorNps.nps!.toFixed(1)})</span>.
          Vale revisar el acompañamiento de ese hiperfoco.
        </>
      ),
    })
  }
  const masLento = tiempoList[0]
  if (masLento && masLento.avg > EXPECTED_MONTHS) {
    const reps = repetidosList.find(r => r.title === masLento.title)?.reps ?? 0
    insights.push({
      color: '#BA7517',
      body: (
        <>
          <span className="text-cream font-medium">{masLento.title} toma {masLento.avg.toFixed(1)} meses en promedio</span> cuando
          lo esperado son {EXPECTED_MONTHS}{reps > 0 && <>; {reps} empresarios lo repiten</>}. Posible falta de ritmo o acompañamiento.
        </>
      ),
    })
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cream-dim">Operación y salud del negocio</p>
          <p className="text-xs text-cream-muted mt-0.5">Solo tú (owner) ves esta sección · {formatMonthLong(periodoActual)}</p>
        </div>
        {productOptions.length > 1 && (
          <ProductFilter options={productOptions} value={productoFilter} />
        )}
      </div>

      {/* Eligieron hiperfoco + Upsell/multi-producto — mismo lenguaje visual
          que los KPI de arriba (número grande primero): antes el número era
          más chico que la etiqueta y la información quedaba "escondida"
          (feedback de Juan, 2026-07-07 noche). */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="card card-glow">
          <div className="card-glow-orb opacity-20" style={{ background: '#DA7D41' }} />
          <div className="relative flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-brand-600/15 flex items-center justify-center shrink-0">
              <Target size={16} className="text-brand-400" />
            </div>
            <p className="text-3xl font-bold tabular-nums text-cream">
              {eligieron} <span className="text-base text-cream-dim font-normal">/ {totalActivos}</span>
            </p>
          </div>
          <p className="relative text-sm text-cream-muted">
            Eligieron hiperfoco este mes
            {sinElegir > 0 && <span className="text-amber-400"> · {sinElegir} sin elegir</span>}
          </p>
        </div>

        <Link href="/admin/clients?supercliente=1" className="card card-glow hover:border-brand-600/40 transition-colors">
          <div className="card-glow-orb opacity-20" style={{ background: '#34d399' }} />
          <div className="relative flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <p className="text-3xl font-bold tabular-nums text-cream">{multiProducto.length}</p>
          </div>
          <p className="relative text-sm text-cream-muted">
            Clientes con 2+ productos (superclientes) — ver todos
            {multiProducto.length > 0 && (
              <span className="text-cream-dim block mt-0.5">
                {multiProducto.slice(0, 2).map(m => m.products.join(' → ')).join(' · ')}
                {multiProducto.length > 2 && ` · +${multiProducto.length - 2} más`}
              </span>
            )}
          </p>
        </Link>
      </div>

      {/* Top repetidos + Estado de la cartera */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <p className="text-sm font-medium text-cream">Top hiperfocos repetidos</p>
          <p className="text-xs text-cream-muted mb-3">Empresarios que repiten 2+ veces seguidas</p>
          {repetidosList.filter(r => r.reps > 0).length === 0 ? (
            <p className="text-sm text-cream-muted">Sin repeticiones registradas todavía.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {repetidosList.filter(r => r.reps > 0).map(r => (
                <div key={r.title} className="flex justify-between">
                  <span className="text-cream">{r.title}</span>
                  <span className="font-medium text-cream">
                    {r.reps} emp. <span className="text-xs text-amber-400">{r.pct.toFixed(0)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="text-sm font-medium text-cream">Estado de la cartera</p>
          <p className="text-xs text-cream-muted mb-3">Salud general de los {totalActivos}</p>
          <DonutChart
            centerValue={totalActivos}
            centerLabel="activos"
            segments={[
              { label: 'Activos saludables', value: saludables, color: '#1D9E75' },
              { label: 'Banderas amarillas', value: banderasAmarillas, color: '#BA7517' },
              { label: 'En riesgo', value: enRiesgo, color: '#E24B4A' },
              { label: 'En pausa', value: enPausa, color: '#888780' },
            ]}
          />
        </div>
      </div>

      {/* Insights automáticos (reglas sobre los datos) */}
      {insights.length > 0 && (
        <div className="card mb-4">
          <p className="text-sm font-medium text-cream inline-flex items-center gap-1.5">
            <Lightbulb size={15} className="text-amber-400" /> Insights automáticos
          </p>
          <div className="flex flex-col gap-2.5 mt-3">
            {insights.map((ins, i) => (
              <p key={i} className="text-xs text-cream-muted leading-relaxed pl-3 border-l-2" style={{ borderColor: ins.color }}>
                {ins.body}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
