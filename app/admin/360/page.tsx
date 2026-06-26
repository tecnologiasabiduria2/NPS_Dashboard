import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'

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

export default async function Vista360Page() {
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

  const [
    { data: activos },
    { data: hiperfocos },
    { data: historia },
    { data: banderas },
    { data: npsRows },
  ] = await Promise.all([
    supabase.from('user_access').select('user_id, access_until, access_started').eq('status', 'active'),
    supabase.from('hiperfocos').select('id, title'),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, periodo, estado, hiperfoco_id')
      .order('user_id', { ascending: true })
      .order('periodo', { ascending: true })
      .limit(2000),
    supabase.from('client_flags').select('user_id').eq('type', 'bandera').eq('status', 'abierta'),
    supabase.from('nps_responses').select('user_id, score, created_at').limit(2000),
  ])

  const activeRows = (activos as any[]) ?? []
  const activeIds = new Set<string>(activeRows.map(r => r.user_id))
  const totalActivos = activeIds.size
  const hfTitle = new Map<string, string>(((hiperfocos as any[]) ?? []).map(h => [h.id, h.title]))
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
  const distrib = new Map<string, { count: number; npsSum: number; npsN: number }>()
  for (const id of activeIds) {
    const cur = estadoActual.get(id)
    if (cur?.estado === 'en_curso' && cur.hiperfoco_id) {
      const d = distrib.get(cur.hiperfoco_id) ?? { count: 0, npsSum: 0, npsN: 0 }
      d.count++
      distrib.set(cur.hiperfoco_id, d)
    }
  }
  // NPS de este mes atribuido al hiperfoco en curso del cliente.
  for (const r of npsAll) {
    if (r.created_at.slice(0, 7) !== periodoActual.slice(0, 7)) continue
    const cur = estadoActual.get(r.user_id)
    if (cur?.estado === 'en_curso' && cur.hiperfoco_id) {
      const d = distrib.get(cur.hiperfoco_id)
      if (d) { d.npsSum += r.score; d.npsN++ }
    }
  }
  const distribList = [...distrib.entries()]
    .map(([hid, d]) => ({
      title: hfTitle.get(hid) ?? '—',
      count: d.count,
      nps: d.npsN ? d.npsSum / d.npsN : null,
      pct: eligieron ? (d.count / eligieron) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // --- Recorrido del historial por usuario: runs de hiperfoco consecutivo --
  // Para tiempo promedio (largo de cada run) y top repetidos (runs >= 2).
  const porUsuario = new Map<string, { periodo: string; hiperfoco_id: string | null }[]>()
  for (const row of (historia as any[]) ?? []) {
    if (!activeIds.has(row.user_id) || !row.hiperfoco_id) continue
    const arr = porUsuario.get(row.user_id) ?? []
    arr.push({ periodo: row.periodo, hiperfoco_id: row.hiperfoco_id })
    porUsuario.set(row.user_id, arr)
  }
  const runLens = new Map<string, number[]>()        // hiperfoco_id -> largos de run
  const repeaters = new Map<string, Set<string>>()   // hiperfoco_id -> usuarios con run >= 2
  const everAssigned = new Map<string, Set<string>>() // hiperfoco_id -> usuarios que lo tuvieron
  for (const [uid, rows] of porUsuario) {
    let i = 0
    while (i < rows.length) {
      const hid = rows[i].hiperfoco_id!
      let j = i
      while (j + 1 < rows.length && rows[j + 1].hiperfoco_id === hid) j++
      const len = j - i + 1
      if (!runLens.has(hid)) runLens.set(hid, [])
      runLens.get(hid)!.push(len)
      if (!everAssigned.has(hid)) everAssigned.set(hid, new Set())
      everAssigned.get(hid)!.add(uid)
      if (len >= 2) {
        if (!repeaters.has(hid)) repeaters.set(hid, new Set())
        repeaters.get(hid)!.add(uid)
      }
      i = j + 1
    }
  }
  const tiempoList = [...runLens.entries()]
    .map(([hid, lens]) => ({
      title: hfTitle.get(hid) ?? '—',
      avg: lens.reduce((a, b) => a + b, 0) / lens.length,
    }))
    .sort((a, b) => b.avg - a.avg)
  const repetidosList = [...everAssigned.entries()]
    .map(([hid, users]) => {
      const reps = repeaters.get(hid)?.size ?? 0
      return {
        title: hfTitle.get(hid) ?? '—',
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
    <div className="max-w-4xl">
      <h1 className="page-title">Vista 360 ejecutiva</h1>
      <p className="page-subtitle mb-6">
        Estado del negocio en una pantalla · {formatMonthLong(periodoActual)} {periodoActual.slice(0, 4)}
      </p>

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
          <p className="text-xs text-cream-dim">{eligieron} empresarios</p>
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
        <div className="card">
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
