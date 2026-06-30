import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb, AlertTriangle } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import ProductFilter from './ProductFilter'

// Objetivo de sesiones 1:1 por CS por mes. Configurable via settings table (pendiente — ver PENDIENTES.md).
const CS_SESSION_TARGET_MONTHLY = 20

// ============================================================================
// VISTA 360 EJECUTIVA — Diana (rol owner). Boceto: sabiduria_dashboard_360_diana.html
// Solo lectura, todo server-side desde las tablas del modelo de hiperfoco.
//
// ⚠️ Escala: las métricas de cartera que recorren TODO el historial
// (tiempo promedio + top repetidos) se calculan en JS sobre user_hiperfoco_mes.
// Para el beta actual (pocos clientes) es exacto; si el historial supera ~1–2k
// filas conviene mover esas dos agregaciones a una vista/RPC en Postgres.
// ============================================================================

// Color por hiperfoco (hex del boceto), por palabra clave del título.
function hiperfocoColor(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('venta')) return '#1D9E75'
  if (t.includes('marketing')) return '#534AB7'
  if (t.includes('finanz')) return '#378ADD'
  if (t.includes('equipo') || t.includes('proceso')) return '#BA7517'
  return '#7A8A85'
}

// Clave 'YYYY-MM-01' del primer día de un mes (local), desplazando `offset` meses.
function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const EXPECTED_MONTHS = 6 // tiempo esperado por hiperfoco antes de cambiar de tema

export default async function Vista360Page({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>
}) {
  const { producto: productoFilter = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Guard de owner: el panel admin deja entrar a admin+owner, pero la 360 es de Diana.
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'owner') redirect('/admin/dashboard')

  const periodoActual = periodoKey(0)
  const periodoPrev = periodoKey(-1)
  const todayStr = new Date().toISOString().slice(0, 10)
  const plus90Str = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const periodoProximo = periodoKey(1)

  const [
    { data: activos },
    { data: hiperfocos },
    { data: historia },
    { data: banderas },
    { data: npsRows },
    { data: uhmCS },
    { data: sessions1x1Raw },
  ] = await Promise.all([
    supabase.from('user_access').select('user_id, access_until, access_started').eq('status', 'active'),
    supabase.from('hiperfocos').select('id, title, products(slug, title)'),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, periodo, estado, hiperfoco_id')
      .order('user_id', { ascending: true })
      .order('periodo', { ascending: true })
      .limit(2000),
    supabase.from('client_flags').select('user_id').eq('type', 'bandera').eq('status', 'abierta'),
    supabase.from('nps_responses').select('user_id, score, created_at').limit(2000),
    // HTML4: clientes con CS asignado este mes
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, cs_id')
      .eq('periodo', periodoActual)
      .not('cs_id', 'is', null),
    // HTML4 + B15: sesiones 1:1 REALIZADAS este mes = coaching_notes (notas + grabación
    // que el coach registra). Antes se contaba live_sessions individual (agendadas);
    // la fuente de verdad del 1:1 realizado es coaching_notes. admin_id = el CS que la
    // registró; user_id = el cliente atendido.
    supabase
      .from('coaching_notes')
      .select('user_id, admin_id, session_date')
      .gte('session_date', periodoActual)
      .lt('session_date', periodoProximo),
  ])

  // HTML4: perfiles de CS y clientes sin 1:1 (query secuencial sobre IDs derivados)
  const uhmCSRows = (uhmCS ?? []) as any[]
  // notas 1:1 (coaching_notes) realizadas este mes — fuente de verdad del 1:1 (B15)
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

  // HTML4 + B15: sesiones 1:1 por CS = coaching_notes agrupadas por admin_id (el CS
  // que registró la sesión). clientes por CS sigue saliendo de la asignación (uhm.cs_id).
  const sessionsByCS = new Map<string, number>()
  for (const n of sessions1x1Rows) {
    if (n.admin_id) sessionsByCS.set(n.admin_id, (sessionsByCS.get(n.admin_id) ?? 0) + 1)
  }
  const clientsByCS = new Map<string, number>()
  for (const r of uhmCSRows) clientsByCS.set(r.cs_id, (clientsByCS.get(r.cs_id) ?? 0) + 1)

  // HTML4: NPS promedio por CS (NPS de este mes cruzado con cs_id del cliente)
  const csOfClient = new Map<string, string>(uhmCSRows.map((r: any) => [r.user_id as string, r.cs_id as string]))
  const npsByCS = new Map<string, { sum: number; count: number }>()
  for (const r of (npsRows ?? []) as any[]) {
    if ((r.created_at as string).slice(0, 7) !== periodoActual.slice(0, 7)) continue
    const csId = csOfClient.get(r.user_id as string)
    if (!csId) continue
    const d = npsByCS.get(csId) ?? { sum: 0, count: 0 }
    d.sum += Number(r.score); d.count++
    npsByCS.set(csId, d)
  }

  // Lista de CS ordenada por sesiones completadas desc
  const csList = csIds.map(id => ({
    id,
    name: profileMap.get(id) ?? '—',
    clientes: clientsByCS.get(id) ?? 0,
    sesiones: sessionsByCS.get(id) ?? 0,
    nps: npsByCS.has(id) ? npsByCS.get(id)!.sum / npsByCS.get(id)!.count : null,
  })).sort((a, b) => b.sesiones - a.sesiones)

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
  // B16: etiqueta = "Título · Producto" para SEPARAR hiperfocos homónimos entre
  // productos (ej. "Marketing · Sabiduría" vs "Marketing · Desafío"). Como todo el
  // agrupado de abajo se hace por esta etiqueta, separa por producto sin más cambios.
  const hfTitle = new Map<string, string>(
    ((hiperfocos as any[]) ?? []).map(h => [
      h.id,
      h.products?.title ? `${h.title} · ${h.products.title}` : h.title,
    ])
  )

  // Filtro de producto (desplegable): opciones distintas + set de hiperfocos en
  // alcance. Solo afecta las secciones por hiperfoco (distribución/tiempo/repetidos);
  // KPIs, cartera y Operación CS quedan globales. "" = todos.
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

  // --- KPIs simples sobre user_access ------------------------------------
  const nuevosEsteMes = activeRows.filter(r => (r.access_started ?? '') >= periodoActual).length
  const renovRows = activeRows.filter(r => r.access_until && r.access_until >= todayStr && r.access_until <= plus90Str)
  const renovacion90d = renovRows.length
  const renovEnRiesgo = renovRows.filter(r => flaggedIds.has(r.user_id)).length

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

  // --- NPS general (todas las respuestas registradas) --------------------
  const npsAll = ((npsRows as any[]) ?? []).map(r => ({ user_id: r.user_id, score: Number(r.score), created_at: String(r.created_at) }))
  const npsGeneral = npsAll.length ? npsAll.reduce((a, r) => a + r.score, 0) / npsAll.length : null

  // --- Distribución por hiperfoco (mes actual) + NPS del mes por hiperfoco
  // Agrupado por etiqueta "Título · Producto" (B16): separa hiperfocos homónimos
  // entre productos en filas distintas.
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
  // Denominador del % = total en alcance (con filtro, relativo a lo mostrado;
  // sin filtro coincide con `eligieron` porque cada elector tiene 1 hiperfoco).
  const distribTotal = [...distrib.values()].reduce((a, d) => a + d.count, 0)
  const distribList = [...distrib.entries()]
    .map(([title, d]) => ({
      title,
      count: d.count,
      nps: d.npsN ? d.npsSum / d.npsN : null,
      pct: distribTotal ? (d.count / distribTotal) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // --- Recorrido del historial por usuario: runs de hiperfoco consecutivo --
  // Para tiempo promedio (largo de cada run) y top repetidos (runs >= 2).
  const porUsuario = new Map<string, { periodo: string; hiperfoco_id: string | null }[]>()
  for (const row of (historia as any[]) ?? []) {
    if (!activeIds.has(row.user_id) || !inScope(row.hiperfoco_id)) continue
    const arr = porUsuario.get(row.user_id) ?? []
    arr.push({ periodo: row.periodo, hiperfoco_id: row.hiperfoco_id })
    porUsuario.set(row.user_id, arr)
  }
  // Agregado por etiqueta "Título · Producto" (B16): los runs se detectan por id
  // consecutivo y se acumulan bajo la etiqueta, que ya separa por producto.
  const runLens = new Map<string, number[]>()        // etiqueta -> largos de run
  const repeaters = new Map<string, Set<string>>()   // etiqueta -> usuarios con run >= 2
  const everAssigned = new Map<string, Set<string>>() // etiqueta -> usuarios que lo tuvieron
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
  // riesgo (2 meses sin elegir) > bandera abierta > pausa este mes > saludable.
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
    <div className="max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">Vista 360 ejecutiva</h1>
          <p className="page-subtitle">
            Estado del negocio en una pantalla · {formatMonthLong(periodoActual)} {periodoActual.slice(0, 4)}
          </p>
        </div>
        {productOptions.length > 1 && (
          <ProductFilter options={productOptions} value={productoFilter} />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card">
          <p className="text-xs text-cream-muted">Empresarios activos</p>
          <p className="text-2xl font-semibold text-cream mt-0.5">{totalActivos}</p>
          <p className="text-xs text-emerald-400 mt-0.5">{nuevosEsteMes > 0 ? `+${nuevosEsteMes} este mes` : 'sin altas este mes'}</p>
        </div>
        <div className="card">
          <p className="text-xs text-cream-muted">Eligieron hiperfoco</p>
          <p className="text-2xl font-semibold text-cream mt-0.5">
            {eligieron} <span className="text-xs text-cream-dim font-normal">/ {totalActivos}</span>
          </p>
          <p className="text-xs text-amber-400 mt-0.5">{sinElegir} sin elegir</p>
        </div>
        <div className="card">
          <p className="text-xs text-cream-muted">NPS general</p>
          <p className="text-2xl font-semibold text-cream mt-0.5">{npsGeneral !== null ? npsGeneral.toFixed(1) : '—'}</p>
          <p className="text-xs text-cream-dim mt-0.5">{npsAll.length} respuestas</p>
        </div>
        <div className="card">
          <p className="text-xs text-cream-muted">Renovación 15d</p>
          <p className="text-2xl font-semibold text-cream mt-0.5">
            {renovacion90d} <span className="text-xs text-cream-dim font-normal">clientes</span>
          </p>
          <p className="text-xs text-red-400 mt-0.5">{renovEnRiesgo} en riesgo</p>
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
                  <div className="h-full rounded-full" style={{ width: `${d.pct.toFixed(1)}%`, background: hiperfocoColor(d.title) }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tiempo promedio por hiperfoco */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream">Tiempo promedio por hiperfoco</p>
        <p className="text-xs text-cream-muted mb-3">Esperado: {EXPECTED_MONTHS} meses · cuántos toman antes de cambiar de tema</p>
        {tiempoList.length === 0 ? (
          <p className="text-sm text-cream-muted">Aún no hay historial suficiente para calcular tiempos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tiempoList.map(t => {
              const overdue = t.avg > EXPECTED_MONTHS
              return (
                <div key={t.title} className="grid grid-cols-[130px_1fr_72px] gap-3 items-center text-sm">
                  <span className="text-cream">{t.title}</span>
                  <div className="relative h-1.5 rounded-full bg-surface-800">
                    <div className="absolute h-full rounded-full" style={{ width: `${Math.min(100, (t.avg / 10) * 100)}%`, background: hiperfocoColor(t.title) }} />
                    {/* marca del esperado (6 meses = 60% de una escala de 10) */}
                    <div className="absolute -top-1 h-3.5 w-px bg-cream-dim" style={{ left: `${(EXPECTED_MONTHS / 10) * 100}%` }} />
                  </div>
                  <span className={`text-right font-medium ${overdue ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {t.avg.toFixed(1)} m{overdue ? ' ↑' : ''}
                  </span>
                </div>
              )
            })}
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
          <div className="flex flex-col gap-2 text-sm">
            {[
              { label: 'Activos saludables', value: saludables, dot: '#1D9E75' },
              { label: 'Banderas amarillas', value: banderasAmarillas, dot: '#BA7517' },
              { label: 'En riesgo', value: enRiesgo, dot: '#E24B4A' },
              { label: 'En pausa', value: enPausa, dot: '#888780' },
            ].map(s => (
              <div key={s.label} className="flex justify-between">
                <span className="text-cream inline-flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <span className="font-medium text-cream">{s.value}</span>
              </div>
            ))}
          </div>
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
          HTML4 — Operación CS
      ================================================================ */}
      <div className="mt-8 mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-cream-dim">Operación CS</p>
      </div>

      {/* Bloque 1: Sesiones 1:1 por CS */}
      <div className="card mb-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-sm font-medium text-cream">Sesiones 1:1 completadas · {formatMonthLong(periodoActual)}</p>
          <p className="text-xs text-cream-dim">Objetivo: {CS_SESSION_TARGET_MONTHLY} por CS / mes</p>
        </div>
        {csList.length === 0 ? (
          <p className="text-sm text-cream-muted">Sin CS asignados a clientes este mes.</p>
        ) : (
          <>
            <div className="space-y-3">
              {csList.map(cs => {
                const pct = Math.min(100, (cs.sesiones / CS_SESSION_TARGET_MONTHLY) * 100)
                const ok = cs.sesiones >= CS_SESSION_TARGET_MONTHLY
                const warn = cs.sesiones >= CS_SESSION_TARGET_MONTHLY * 0.7
                const barColor = ok ? '#1D9E75' : warn ? '#BA7517' : '#E24B4A'
                const textColor = ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-red-400'
                return (
                  <div key={cs.id} className="grid grid-cols-[140px_1fr_90px] gap-3 items-center text-sm">
                    <div>
                      <p className="text-cream font-medium truncate">{cs.name}</p>
                      <p className="text-xs text-cream-muted">{cs.clientes} cliente{cs.clientes !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span className={`font-medium text-right ${textColor}`}>
                      {cs.sesiones} / {CS_SESSION_TARGET_MONTHLY}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="pt-3 mt-2 border-t border-surface-700 grid grid-cols-3 gap-3 text-xs text-cream-muted">
              <div>
                <p>Total sesiones</p>
                <p className="text-base font-semibold text-cream mt-0.5">{sessions1x1Rows.length} / {csList.length * CS_SESSION_TARGET_MONTHLY}</p>
              </div>
              <div>
                <p>Cumplimiento global</p>
                <p className={`text-base font-semibold mt-0.5 ${
                  csList.length * CS_SESSION_TARGET_MONTHLY > 0
                    ? sessions1x1Rows.length / (csList.length * CS_SESSION_TARGET_MONTHLY) >= 1
                      ? 'text-emerald-400'
                      : sessions1x1Rows.length / (csList.length * CS_SESSION_TARGET_MONTHLY) >= 0.7
                      ? 'text-amber-400'
                      : 'text-red-400'
                    : 'text-cream'
                }`}>
                  {csList.length * CS_SESSION_TARGET_MONTHLY > 0
                    ? `${Math.round((sessions1x1Rows.length / (csList.length * CS_SESSION_TARGET_MONTHLY)) * 100)}%`
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

      {/* Bloque 2: Clientes sin 1:1 este mes */}
      {totalSin1x1 > 0 && (
        <div className="card mb-4" style={{ borderColor: 'rgba(226,75,74,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm font-medium text-red-400">Clientes sin 1:1 este mes</p>
          </div>
          <p className="text-xs text-cream-muted mb-3">
            {totalSin1x1} empresario{totalSin1x1 !== 1 ? 's' : ''} con CS asignado no ha{totalSin1x1 !== 1 ? 'n' : ''} tenido su sesión individual este mes
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

      {/* Bloque 3: Salud por CS — NPS promedio */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream mb-0.5">Salud por CS — NPS promedio de la cartera</p>
        <p className="text-xs text-cream-muted mb-3">Promedio de respuestas NPS de este mes atribuidas a cada CS</p>
        {csList.filter(cs => cs.nps !== null).length === 0 ? (
          <p className="text-sm text-cream-muted">Sin respuestas NPS este mes todavía.</p>
        ) : (
          <>
            <div className="space-y-2.5">
              {[...csList]
                .filter(cs => cs.nps !== null)
                .sort((a, b) => (b.nps ?? 0) - (a.nps ?? 0))
                .map(cs => (
                  <div key={cs.id} className="grid grid-cols-[140px_1fr_52px] gap-3 items-center text-sm">
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
                    {peorNpsCS.name} tiene el menor cumplimiento de sesiones ({peorOpCS.sesiones}/{CS_SESSION_TARGET_MONTHLY}) y el NPS más bajo ({peorNpsCS.nps!.toFixed(1)}).
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
