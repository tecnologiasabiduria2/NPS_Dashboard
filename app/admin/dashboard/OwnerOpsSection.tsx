import type { ReactNode } from 'react'
import Link from 'next/link'
import { Lightbulb, AlertTriangle, Target, Star, TrendingUp } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getHiperfocoVisual } from '@/lib/hiperfocoVisual'
import DonutChart from '@/components/DonutChart'
import ProductFilter from './ProductFilter'
import CsTargetEditor from './CsTargetEditor'
import MonthFilter from './MonthFilter'
import CsFilter from './CsFilter'
import HiperfocoMentorSelect from './HiperfocoMentorSelect'

// ============================================================================
// OPERACIÓN Y SALUD DEL NEGOCIO — solo owner (Diana). Antes era /admin/360
// completa; se fusionó al Dashboard (calibración 2026-07-06) porque varios
// KPIs quedaban duplicados con el dashboard (activos, NPS general, ventana de
// renovación). Lo que sigue es lo que NO existe en ningún otro lado.
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
  searchParams: Promise<{ producto?: string; cs_mes?: string; cs?: string }>
}) {
  const { producto: productoFilter = '', cs_mes: csMesParam, cs: csFilterParam = '' } = await searchParams
  const supabase = await createClient()

  // B13: objetivo de sesiones 1:1 por CS/mes, configurable por el owner (Diana).
  // Resiliente: si la migración platform_settings aún no corrió, usa 20.
  const { data: csTargetRow } = await supabaseAdmin
    .from('platform_settings').select('value').eq('key', 'cs_session_target_monthly').maybeSingle()
  const csTarget = Number(csTargetRow?.value) || 20

  const periodoActual = periodoKey(0)
  const periodoPrev = periodoKey(-1)

  // Filtro de mes para "Sesiones 1:1 por CS" (independiente del resto de la sección,
  // que sigue siempre en el mes actual). Últimos 6 meses + el actual, más reciente primero.
  const csMesOptions = Array.from({ length: 6 }, (_, i) => {
    const p = periodoKey(-i)
    return { value: p.slice(0, 7), label: formatMonthLong(p) }
  })
  const csMesSel = csMesOptions.find(o => o.value === csMesParam)?.value ?? periodoActual.slice(0, 7)
  const csMesPeriodo = `${csMesSel}-01`
  const csMesPeriodoNextDate = new Date(`${csMesPeriodo}T00:00:00`)
  csMesPeriodoNextDate.setMonth(csMesPeriodoNextDate.getMonth() + 1)
  const csMesPeriodoNext = `${csMesPeriodoNextDate.getFullYear()}-${String(csMesPeriodoNextDate.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: activos },
    { data: hiperfocos },
    { data: historia },
    { data: banderas },
    { data: npsRows },
    { data: uhmCS },
    { data: sessions1x1Raw },
    { data: exitosRaw },
    { data: mentoresMes },
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
    // clientes con CS asignado en el mes seleccionado (filtro independiente, csMesPeriodo)
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, cs_id')
      .eq('periodo', csMesPeriodo)
      .not('cs_id', 'is', null),
    // sesiones 1:1 REALIZADAS en el mes seleccionado = coaching_notes (notas +
    // grabación que el coach registra). admin_id = el CS que la registró;
    // user_id = el cliente atendido.
    supabase
      .from('coaching_notes')
      .select('user_id, admin_id, session_date')
      .gte('session_date', csMesPeriodo)
      .lt('session_date', csMesPeriodoNext),
    // casos de éxito atribuidos al CS que los marcó (created_by), para el filtro por CS.
    supabase.from('client_flags').select('created_by').eq('type', 'caso_exito').eq('status', 'abierta'),
    // mentor asignado por hiperfoco en el mes seleccionado (RLS sin policies → supabaseAdmin).
    supabaseAdmin.from('hiperfoco_mentor_mes').select('hiperfoco_id, mentor_id').eq('periodo', csMesPeriodo),
    // upsell/multi-producto (calibración 2026-07-06): TODAS las filas de
    // user_access sin filtrar por status, para contar productos distintos
    // por cliente (activos o no).
    supabase.from('user_access').select('user_id, product_id, products(title), profiles(full_name)'),
  ])

  // perfiles de CS y clientes sin 1:1 (query secuencial sobre IDs derivados)
  const uhmCSRows = (uhmCS ?? []) as any[]
  const sessions1x1Rows = (sessions1x1Raw ?? []) as any[]
  const clientsWithSessionSet = new Set<string>(sessions1x1Rows.map((n: any) => n.user_id as string))
  const csIds = [...new Set<string>(uhmCSRows.map((r: any) => r.cs_id as string))]
  const clientesSin1x1Rows = uhmCSRows.filter((r: any) => !clientsWithSessionSet.has(r.user_id as string))
  const clientIdsNeeded = clientesSin1x1Rows.slice(0, 30).map((r: any) => r.user_id as string)
  const profileIdsNeeded = [...new Set<string>([...csIds, ...clientIdsNeeded])]

  const profileMap = new Map<string, string>()
  if (profileIdsNeeded.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIdsNeeded)
    for (const p of (profData ?? []) as any[]) profileMap.set(p.id, p.full_name ?? '—')
  }

  // sesiones 1:1 por CS = coaching_notes agrupadas por admin_id (el CS que
  // registró la sesión). clientes por CS sigue saliendo de la asignación (uhm.cs_id).
  const sessionsByCS = new Map<string, number>()
  for (const n of sessions1x1Rows) {
    if (n.admin_id) sessionsByCS.set(n.admin_id, (sessionsByCS.get(n.admin_id) ?? 0) + 1)
  }
  const clientsByCS = new Map<string, number>()
  for (const r of uhmCSRows) clientsByCS.set(r.cs_id, (clientsByCS.get(r.cs_id) ?? 0) + 1)

  // NPS promedio por CS (NPS del mes seleccionado cruzado con cs_id del cliente)
  const csOfClient = new Map<string, string>(uhmCSRows.map((r: any) => [r.user_id as string, r.cs_id as string]))
  const npsByCS = new Map<string, { sum: number; count: number }>()
  for (const r of (npsRows ?? []) as any[]) {
    if ((r.created_at as string).slice(0, 7) !== csMesSel) continue
    const csId = csOfClient.get(r.user_id as string)
    if (!csId) continue
    const d = npsByCS.get(csId) ?? { sum: 0, count: 0 }
    d.sum += Number(r.score); d.count++
    npsByCS.set(csId, d)
  }

  // Casos de éxito abiertos, atribuidos al CS que los marcó (created_by).
  const exitosByCS = new Map<string, number>()
  for (const f of (exitosRaw ?? []) as any[]) {
    if (f.created_by) exitosByCS.set(f.created_by, (exitosByCS.get(f.created_by) ?? 0) + 1)
  }

  // Lista de CS ordenada por sesiones completadas desc
  const csList = csIds.map(id => ({
    id,
    name: profileMap.get(id) ?? '—',
    clientes: clientsByCS.get(id) ?? 0,
    sesiones: sessionsByCS.get(id) ?? 0,
    nps: npsByCS.has(id) ? npsByCS.get(id)!.sum / npsByCS.get(id)!.count : null,
    exitos: exitosByCS.get(id) ?? 0,
  })).sort((a, b) => b.sesiones - a.sesiones)

  // Filtro por CS (Operación CS): "" = todos. Si el filtro no coincide con
  // ningún CS del alcance actual (ej. cambió de mes), cae a "todos" sin romper.
  const csFilterSel = csList.some(cs => cs.id === csFilterParam) ? csFilterParam : ''
  const csListFiltered = csFilterSel ? csList.filter(cs => cs.id === csFilterSel) : csList

  // Clientes sin 1:1 (máx 10 mostrados en la card)
  const totalSin1x1 = clientesSin1x1Rows.length
  const clientesSin1x1 = clientesSin1x1Rows.slice(0, 10).map((r: any) => ({
    userId: r.user_id as string,
    name: profileMap.get(r.user_id as string) ?? '—',
    csId: r.cs_id as string,
    csName: profileMap.get(r.cs_id as string) ?? '—',
  }))

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

  // --- Mentor por hiperfoco/mes (calibración 2026-07-06) ------------------
  // Quién dictó cada hiperfoco en el mes seleccionado (csMesSel/csMesPeriodo,
  // el mismo filtro que "Sesiones 1:1"), distinto de cs_id (coach 1:1 del
  // cliente). De ahí se derivan los clientes que se relacionan con ese mentor.
  const mentorByHf = new Map<string, string>(
    ((mentoresMes as any[]) ?? []).map(m => [m.hiperfoco_id as string, m.mentor_id as string])
  )
  const clientesPorHfCsMes = new Map<string, Set<string>>()
  for (const row of (historia as any[]) ?? []) {
    if (row.periodo !== csMesPeriodo || row.estado !== 'en_curso' || !row.hiperfoco_id) continue
    if (!activeIds.has(row.user_id)) continue
    if (!clientesPorHfCsMes.has(row.hiperfoco_id)) clientesPorHfCsMes.set(row.hiperfoco_id, new Set())
    clientesPorHfCsMes.get(row.hiperfoco_id)!.add(row.user_id)
  }
  const npsPorHfCsMes = new Map<string, { sum: number; count: number }>()
  for (const r of npsAll) {
    if (!r.hiperfoco_id || r.created_at.slice(0, 7) !== csMesSel) continue
    const d = npsPorHfCsMes.get(r.hiperfoco_id) ?? { sum: 0, count: 0 }
    d.sum += r.score; d.count++
    npsPorHfCsMes.set(r.hiperfoco_id, d)
  }
  const hiperfocosMentorList = ((hiperfocos as any[]) ?? [])
    .filter(h => h.is_active && (!productoFilter || h.products?.slug === productoFilter))
    .map(h => {
      const nps = npsPorHfCsMes.get(h.id)
      return {
        id: h.id as string,
        title: hfTitle.get(h.id) ?? h.title,
        clientes: clientesPorHfCsMes.get(h.id)?.size ?? 0,
        nps: nps ? nps.sum / nps.count : null,
        mentorId: mentorByHf.get(h.id) ?? '',
      }
    })
    .sort((a, b) => b.clientes - a.clientes)

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

  const npsColor = (v: number) => (v >= 8 ? 'text-emerald-400' : v >= 6 ? 'text-amber-400' : 'text-red-400')

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

      {/* Eligieron hiperfoco + Upsell/multi-producto */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="card flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-brand-600/15 flex items-center justify-center shrink-0">
            <Target size={16} className="text-brand-400" />
          </div>
          <div>
            <p className="text-xs text-cream-muted">Eligieron hiperfoco este mes</p>
            <p className="text-lg font-semibold text-cream">
              {eligieron} <span className="text-xs text-cream-dim font-normal">/ {totalActivos}</span>
              <span className="text-xs text-amber-400 font-normal ml-2">{sinElegir} sin elegir</span>
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-cream-muted">Clientes con 2+ productos</p>
            <p className="text-lg font-semibold text-cream">
              {multiProducto.length}
              {multiProducto.length > 0 && (
                <span className="text-xs text-cream-dim font-normal ml-2">
                  {multiProducto.slice(0, 2).map(m => m.products.join(' → ')).join(' · ')}
                  {multiProducto.length > 2 && ` · +${multiProducto.length - 2} más`}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Distribución por hiperfoco */}
      <div className="card mb-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm font-medium text-cream">Distribución por hiperfoco · {formatMonthLong(periodoActual)}</p>
          <p className="text-xs text-cream-dim">{distribTotal} empresarios</p>
        </div>
        {distribList.length === 0 ? (
          <p className="text-sm text-cream-muted">Nadie tiene un hiperfoco en curso este mes todavía.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {distribList.map(d => (
              <div key={d.title}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-sm text-cream">{d.title}</span>
                  <span className="text-xs text-cream-muted">
                    {d.count} empresarios{d.nps !== null && <> · <span className={npsColor(d.nps)}>NPS {d.nps.toFixed(1)}</span></>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${d.pct.toFixed(1)}%`, background: getHiperfocoVisual(d.title).solid }} />
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* ================================================================
          Operación CS
      ================================================================ */}
      <div className="mt-8 mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-cream-dim">Operación CS</p>
      </div>

      {/* Bloque 1: Sesiones 1:1 por CS */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-medium text-cream">Sesiones 1:1 completadas · {formatMonthLong(csMesPeriodo)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <CsFilter value={csFilterSel} options={csList.map(cs => ({ id: cs.id, name: cs.name }))} />
            <MonthFilter value={csMesSel} options={csMesOptions} />
            <CsTargetEditor value={csTarget} />
          </div>
        </div>
        {csList.length === 0 ? (
          <p className="text-sm text-cream-muted">Sin CS asignados a clientes este mes.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {csListFiltered.map(cs => {
                const pct = Math.min(100, (cs.sesiones / csTarget) * 100)
                const ok = cs.sesiones >= csTarget
                const warn = cs.sesiones >= csTarget * 0.7
                const barColor = ok ? '#1D9E75' : warn ? '#BA7517' : '#E24B4A'
                const textColor = ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-red-400'
                return (
                  <div key={cs.id} className="bg-surface-800 rounded-xl px-4 py-3.5">
                    <p className="text-sm text-cream font-medium truncate">{cs.name}</p>
                    <p className="text-xs text-cream-muted mb-3">{cs.clientes} cliente{cs.clientes !== 1 ? 's' : ''}</p>
                    <div className="h-2 rounded-full bg-surface-900 overflow-hidden mb-1.5">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-bold leading-none ${textColor}`}>{cs.sesiones}/{csTarget}</span>
                      <span className={`text-xs font-medium ${textColor}`}>{Math.round(pct)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="pt-3 mt-2 border-t border-surface-700 grid grid-cols-3 gap-3 text-xs text-cream-muted">
              <div>
                <p>Total sesiones</p>
                <p className="text-base font-semibold text-cream mt-0.5">{sessions1x1Rows.length} / {csList.length * csTarget}</p>
              </div>
              <div>
                <p>Cumplimiento global</p>
                <p className={`text-base font-semibold mt-0.5 ${
                  csList.length * csTarget > 0
                    ? sessions1x1Rows.length / (csList.length * csTarget) >= 1
                      ? 'text-emerald-400'
                      : sessions1x1Rows.length / (csList.length * csTarget) >= 0.7
                      ? 'text-amber-400'
                      : 'text-red-400'
                    : 'text-cream'
                }`}>
                  {csList.length * csTarget > 0
                    ? `${Math.round((sessions1x1Rows.length / (csList.length * csTarget)) * 100)}%`
                    : '—'}
                </p>
              </div>
              <div>
                <p>Clientes sin 1:1</p>
                <p className={`text-base font-semibold mt-0.5 ${totalSin1x1 > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{totalSin1x1}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mentor por hiperfoco — quién dictó cada hiperfoco este mes, y qué
          clientes se relacionan con él (los que tuvieron ese hiperfoco). */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream mb-0.5">Mentor por hiperfoco · {formatMonthLong(csMesPeriodo)}</p>
        <p className="text-xs text-cream-muted mb-3">Quién dictó cada hiperfoco ese mes (distinto del coach 1:1 asignado a cada cliente)</p>
        {hiperfocosMentorList.length === 0 ? (
          <p className="text-sm text-cream-muted">No hay hiperfocos activos en este alcance.</p>
        ) : (
          <div className="space-y-2">
            {hiperfocosMentorList.map(h => (
              <div key={h.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm bg-surface-800 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-cream truncate">{h.title}</p>
                  <p className="text-xs text-cream-muted">
                    {h.clientes} cliente{h.clientes !== 1 ? 's' : ''}
                    {h.nps !== null && <> · <span className={npsColor(h.nps)}>NPS {h.nps.toFixed(1)}</span></>}
                  </p>
                </div>
                <HiperfocoMentorSelect
                  hiperfocoId={h.id}
                  periodo={csMesPeriodo}
                  value={h.mentorId}
                  options={csList.map(cs => ({ id: cs.id, name: cs.name }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bloque 2: Clientes sin 1:1 este mes */}
      {totalSin1x1 > 0 && (
        <div className="card mb-4" style={{ borderColor: 'rgba(226,75,74,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm font-medium text-red-400">Clientes sin 1:1 · {formatMonthLong(csMesPeriodo)}</p>
          </div>
          <p className="text-xs text-cream-muted mb-3">
            {totalSin1x1} empresario{totalSin1x1 !== 1 ? 's' : ''} con CS asignado no ha{totalSin1x1 !== 1 ? 'n' : ''} tenido su sesión individual ese mes
          </p>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1fr_130px] gap-3 text-xs text-cream-muted pb-2 border-b border-surface-700">
              <span>Cliente</span>
              <span>CS responsable</span>
            </div>
            {clientesSin1x1.map(c => (
              <div key={c.userId} className="grid grid-cols-[1fr_130px] gap-3 text-sm items-center">
                <Link href={`/admin/clients/${c.userId}`} className="text-cream hover:text-brand-400 transition-colors truncate">
                  {c.name}
                </Link>
                <span className="text-cream-muted text-xs truncate">{c.csName}</span>
              </div>
            ))}
            {totalSin1x1 > 10 && (
              <p className="text-xs text-cream-muted pt-1">
                + {totalSin1x1 - 10} más ·{' '}
                <Link href="/admin/clients" className="text-brand-400">Ver todos →</Link>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bloque 3: Salud por CS — NPS promedio + casos de éxito */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream mb-0.5">Salud por CS — NPS y casos de éxito</p>
        <p className="text-xs text-cream-muted mb-3">NPS promedio de este mes + casos de éxito abiertos, atribuidos a cada CS</p>
        {csListFiltered.filter(cs => cs.nps !== null).length === 0 ? (
          <p className="text-sm text-cream-muted">Sin respuestas NPS este mes {csFilterSel ? 'para este CS' : 'todavía'}.</p>
        ) : (
          <>
            <div className="space-y-2.5">
              {[...csListFiltered]
                .filter(cs => cs.nps !== null)
                .sort((a, b) => (b.nps ?? 0) - (a.nps ?? 0))
                .map(cs => (
                  <div key={cs.id} className="grid grid-cols-[140px_1fr_52px_74px] gap-3 items-center text-sm">
                    <span className="text-cream truncate">{cs.name}</span>
                    <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(cs.nps! / 10) * 100}%`,
                          background: cs.nps! >= 8 ? '#1D9E75' : cs.nps! >= 6 ? '#BA7517' : '#E24B4A',
                        }}
                      />
                    </div>
                    <span className={`text-right font-medium ${npsColor(cs.nps!)}`}>{cs.nps!.toFixed(1)}</span>
                    <span className="text-right text-xs text-emerald-400 inline-flex items-center justify-end gap-1">
                      <Star size={11} /> {cs.exitos}
                    </span>
                  </div>
                ))}
            </div>
            {(() => {
              const withNps = csList.filter(cs => cs.nps !== null)
              const peorNpsCS = [...withNps].sort((a, b) => (a.nps ?? 10) - (b.nps ?? 10))[0]
              const peorOpCS = [...csList].sort((a, b) => a.sesiones - b.sesiones)[0]
              if (peorNpsCS && peorOpCS && peorNpsCS.id === peorOpCS.id && peorNpsCS.nps! < 7.5) {
                return (
                  <p className="text-xs text-cream-muted mt-3 pt-3 border-t border-surface-700 leading-relaxed">
                    <span className="text-amber-400 font-medium">Patrón detectado:</span>{' '}
                    {peorNpsCS.name} tiene el menor cumplimiento de sesiones ({peorOpCS.sesiones}/{csTarget}) y el NPS más bajo ({peorNpsCS.nps!.toFixed(1)}).
                    Posible sobrecarga o necesidad de acompañamiento.
                  </p>
                )
              }
              return null
            })()}
          </>
        )}
      </div>
    </div>
  )
}
