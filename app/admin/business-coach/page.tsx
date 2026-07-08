import { redirect } from 'next/navigation'
import { Star, Users, TrendingUp, Award, CalendarCheck2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { formatMonthLong } from '@/lib/format'
import MonthFilter from '../dashboard/MonthFilter'
import ProductFilter from '../dashboard/ProductFilter'
import HiperfocoMentorSelect from '../dashboard/HiperfocoMentorSelect'
import CreateBusinessCoachForm from './CreateBusinessCoachForm'
import MentorCrud from './MentorCrud'

// ============================================================================
// BUSINESS COACH — página nueva (calibración 2026-07-07 noche), solo owner.
// Reemplaza "Salud por CS" + "Sesiones 1:1 completadas" del dashboard, y
// agrega las métricas que pidió Diana: foto, clientes activos, entregados,
// upsell, casos de éxito, NPS promedio, tasa de asistencia, tasa de ascensión,
// distribución de clientes por BC. También vive aquí "Mentor por hiperfoco"
// (movido desde /admin/clientes-resumen el 2026-07-08: es sobre la clase
// grupal del mes, no sobre operativa de clientes individuales) y el CRUD de
// mentores (dictan la clase grupal, sin acceso a la plataforma).
// ============================================================================

function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function BusinessCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ cs_mes?: string; producto?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'owner') redirect('/admin/dashboard')

  const { cs_mes: csMesParam, producto: productoFilter = '' } = await searchParams
  const csMesOptions = Array.from({ length: 6 }, (_, i) => {
    const p = periodoKey(-i)
    return { value: p.slice(0, 7), label: formatMonthLong(p) }
  })
  const csMesSel = csMesOptions.find(o => o.value === csMesParam)?.value ?? periodoKey(0).slice(0, 7)
  const csMesPeriodo = `${csMesSel}-01`
  const csMesPeriodoNextDate = new Date(`${csMesPeriodo}T00:00:00`)
  csMesPeriodoNextDate.setMonth(csMesPeriodoNextDate.getMonth() + 1)
  const csMesPeriodoNext = `${csMesPeriodoNextDate.getFullYear()}-${String(csMesPeriodoNextDate.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: rosterRaw },
    { data: uhmMes },
    { data: sessions1x1Raw },
    { data: npsRows },
    { data: exitosRaw },
    { data: accesoTodos },
    { data: activos },
    { data: historiaAll },
    { data: mentoresRaw },
    { data: hiperfocos },
    { data: pastSessions },
    { data: mentoresMes },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').eq('role', 'admin').order('full_name'),
    supabase.from('user_hiperfoco_mes').select('user_id, cs_id, hiperfoco_id, estado').eq('periodo', csMesPeriodo),
    supabase
      .from('coaching_notes')
      .select('user_id, admin_id, session_date')
      .gte('session_date', csMesPeriodo)
      .lt('session_date', csMesPeriodoNext),
    supabase.from('nps_responses').select('user_id, score, created_at, hiperfoco_id'),
    supabase.from('client_flags').select('user_id, created_by').eq('type', 'caso_exito'),
    supabase.from('user_access').select('user_id, product_id, products(title)').eq('status', 'active'),
    supabase.from('user_access').select('user_id').eq('status', 'active'),
    supabase.from('user_hiperfoco_mes').select('user_id, cs_id').not('cs_id', 'is', null).limit(5000),
    supabaseAdmin.from('mentores').select('id, nombre, activo').order('nombre'),
    supabase.from('hiperfocos').select('id, title, is_active, products(slug, title)'),
    supabase
      .from('live_sessions')
      .select('id, hiperfoco_nombre, ends_at')
      .lt('ends_at', new Date().toISOString())
      .not('hiperfoco_nombre', 'is', null)
      .order('starts_at', { ascending: false })
      .limit(500),
    supabaseAdmin.from('hiperfoco_mentor_mes').select('hiperfoco_id, mentor_id').eq('periodo', csMesPeriodo),
  ])

  const roster = ((rosterRaw as any[]) ?? [])
  const uhmRows = (uhmMes as any[]) ?? []
  const activeIds = new Set<string>(((activos as any[]) ?? []).map(r => r.user_id))
  const uhmCSRows = uhmRows.filter(r => r.cs_id && r.estado === 'en_curso' && activeIds.has(r.user_id))
  const sessions1x1Rows = (sessions1x1Raw as any[]) ?? []
  const hfRawTitle = new Map<string, string>(((hiperfocos as any[]) ?? []).map(h => [h.id, h.title]))

  // Clientes activos + en curso por BC este mes.
  const clientesByCS = new Map<string, string[]>()
  for (const r of uhmCSRows) {
    if (!clientesByCS.has(r.cs_id)) clientesByCS.set(r.cs_id, [])
    clientesByCS.get(r.cs_id)!.push(r.user_id)
  }

  // Sesiones 1:1 completadas este mes.
  const sessionsByCS = new Map<string, number>()
  for (const n of sessions1x1Rows) {
    if (n.admin_id) sessionsByCS.set(n.admin_id, (sessionsByCS.get(n.admin_id) ?? 0) + 1)
  }

  // NPS promedio (todo el historial de sus clientes actuales, no solo el mes).
  const csOfClient = new Map<string, string>(uhmCSRows.map(r => [r.user_id, r.cs_id]))
  const npsByCS = new Map<string, { sum: number; count: number }>()
  for (const r of (npsRows as any[]) ?? []) {
    const csId = csOfClient.get(r.user_id)
    if (!csId) continue
    const d = npsByCS.get(csId) ?? { sum: 0, count: 0 }
    d.sum += Number(r.score); d.count++
    npsByCS.set(csId, d)
  }

  // Casos de éxito registrados (todos, sin importar estado) atribuidos al BC que los marcó.
  const exitosByCS = new Map<string, number>()
  for (const f of (exitosRaw as any[]) ?? []) {
    if (f.created_by) exitosByCS.set(f.created_by, (exitosByCS.get(f.created_by) ?? 0) + 1)
  }

  // Upsell/ascensión: clientes con 2+ productos, atribuidos al BC actual de ese cliente.
  const productsPerClient = new Map<string, Set<string>>()
  for (const r of (accesoTodos as any[]) ?? []) {
    if (!productsPerClient.has(r.user_id)) productsPerClient.set(r.user_id, new Set())
    if (r.products?.title) productsPerClient.get(r.user_id)!.add(r.products.title)
  }
  const upsellByCS = new Map<string, number>()
  for (const [uid, csId] of csOfClient) {
    if ((productsPerClient.get(uid)?.size ?? 0) >= 2) upsellByCS.set(csId, (upsellByCS.get(csId) ?? 0) + 1)
  }

  // Clientes entregados = distintos clientes que ha tenido este BC alguna vez (histórico).
  const entregadosByCS = new Map<string, Set<string>>()
  for (const r of (historiaAll as any[]) ?? []) {
    if (!entregadosByCS.has(r.cs_id)) entregadosByCS.set(r.cs_id, new Set())
    entregadosByCS.get(r.cs_id)!.add(r.user_id)
  }

  // Tasa de asistencia a clases: agregada sobre las sesiones relevantes de
  // los clientes actuales de cada BC (por el hiperfoco en curso de cada uno).
  const sessionsByRawTitle = new Map<string, string[]>()
  for (const s of (pastSessions as any[]) ?? []) {
    const key = s.hiperfoco_nombre as string
    if (!sessionsByRawTitle.has(key)) sessionsByRawTitle.set(key, [])
    sessionsByRawTitle.get(key)!.push(s.id)
  }
  const relevantSessionIdsAll = new Set<string>()
  for (const r of uhmCSRows) {
    const raw = hfRawTitle.get(r.hiperfoco_id)
    if (raw) for (const sid of sessionsByRawTitle.get(raw) ?? []) relevantSessionIdsAll.add(sid)
  }
  const attendanceByClient = new Map<string, Set<string>>()
  if (relevantSessionIdsAll.size > 0 && uhmCSRows.length > 0) {
    const { data: attendanceRows } = await supabase
      .from('live_session_attendance')
      .select('user_id, session_id')
      .in('session_id', [...relevantSessionIdsAll])
      .in('user_id', uhmCSRows.map(r => r.user_id))
    for (const a of (attendanceRows as any[]) ?? []) {
      if (!attendanceByClient.has(a.user_id)) attendanceByClient.set(a.user_id, new Set())
      attendanceByClient.get(a.user_id)!.add(a.session_id)
    }
  }
  const asistenciaByCS = new Map<string, { asistidas: number; total: number }>()
  for (const r of uhmCSRows) {
    const raw = hfRawTitle.get(r.hiperfoco_id)
    const relevantIds = raw ? (sessionsByRawTitle.get(raw) ?? []) : []
    if (relevantIds.length === 0) continue
    const attended = attendanceByClient.get(r.user_id) ?? new Set()
    const asistidas = relevantIds.filter(id => attended.has(id)).length
    const d = asistenciaByCS.get(r.cs_id) ?? { asistidas: 0, total: 0 }
    d.asistidas += asistidas
    d.total += relevantIds.length
    asistenciaByCS.set(r.cs_id, d)
  }

  const coaches = roster.map(p => {
    const clientesActivos = clientesByCS.get(p.id)?.length ?? 0
    const nps = npsByCS.get(p.id)
    const asistencia = asistenciaByCS.get(p.id)
    const upsell = upsellByCS.get(p.id) ?? 0
    return {
      id: p.id as string,
      name: p.full_name as string,
      avatarUrl: p.avatar_url as string | null,
      clientesActivos,
      sesiones: sessionsByCS.get(p.id) ?? 0,
      entregados: entregadosByCS.get(p.id)?.size ?? 0,
      upsell,
      tasaAscension: clientesActivos > 0 ? (upsell / clientesActivos) * 100 : 0,
      exitos: exitosByCS.get(p.id) ?? 0,
      nps: nps ? nps.sum / nps.count : null,
      tasaAsistencia: asistencia && asistencia.total > 0 ? (asistencia.asistidas / asistencia.total) * 100 : null,
    }
  })

  // --- Mentor por hiperfoco (informativo) — movido desde /admin/clientes-resumen ---
  const hfTitle = new Map<string, string>(
    ((hiperfocos as any[]) ?? []).map(h => [
      h.id,
      h.products?.title ? `${h.title} · ${h.products.title}` : h.title,
    ])
  )
  const productOptions = (() => {
    const seen = new Map<string, string>()
    for (const h of (hiperfocos as any[]) ?? []) {
      const slug = h.products?.slug
      if (slug && !seen.has(slug)) seen.set(slug, h.products?.title ?? slug)
    }
    return [...seen.entries()].map(([slug, title]) => ({ slug, title }))
  })()
  const mentorByHf = new Map<string, string>(
    ((mentoresMes as any[]) ?? []).map(m => [m.hiperfoco_id as string, m.mentor_id as string])
  )
  const clientesPorHf = new Map<string, Set<string>>()
  for (const r of uhmRows) {
    if (r.estado !== 'en_curso' || !r.hiperfoco_id) continue
    if (!clientesPorHf.has(r.hiperfoco_id)) clientesPorHf.set(r.hiperfoco_id, new Set())
    clientesPorHf.get(r.hiperfoco_id)!.add(r.user_id)
  }
  const npsPorHf = new Map<string, { sum: number; count: number }>()
  for (const r of (npsRows as any[]) ?? []) {
    if (!r.hiperfoco_id || String(r.created_at).slice(0, 7) !== csMesSel) continue
    const d = npsPorHf.get(r.hiperfoco_id) ?? { sum: 0, count: 0 }
    d.sum += Number(r.score); d.count++
    npsPorHf.set(r.hiperfoco_id, d)
  }
  const mentorRosterActivos = ((mentoresRaw as any[]) ?? [])
    .filter(m => m.activo)
    .map(m => ({ id: m.id as string, name: m.nombre as string }))
  const hiperfocosMentorList = ((hiperfocos as any[]) ?? [])
    .filter(h => h.is_active && (!productoFilter || h.products?.slug === productoFilter))
    .map(h => {
      const nps = npsPorHf.get(h.id)
      return {
        id: h.id as string,
        title: hfTitle.get(h.id) ?? h.title,
        clientes: clientesPorHf.get(h.id)?.size ?? 0,
        nps: nps ? nps.sum / nps.count : null,
        mentorId: mentorByHf.get(h.id) ?? '',
      }
    })
    .sort((a, b) => b.clientes - a.clientes)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Business Coach</h1>
          <p className="page-subtitle">Desempeño y distribución de clientes por Business Coach · {formatMonthLong(csMesPeriodo)}</p>
        </div>
        <CreateBusinessCoachForm />
      </div>

      <div className="flex justify-end gap-2 mb-4">
        {productOptions.length > 1 && <ProductFilter options={productOptions} value={productoFilter} />}
        <MonthFilter value={csMesSel} options={csMesOptions} />
      </div>

      {/* Tarjetas por Business Coach */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {coaches.map(c => (
          <div key={c.id} className="card card-glow">
            <div className="card-glow-orb opacity-20" style={{ background: '#DA7D41' }} />
            <div className="relative flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-surface-700 overflow-hidden flex items-center justify-center shrink-0">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-cream-muted">{c.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-cream">{c.name}</p>
                <p className="text-xs text-cream-muted">{c.clientesActivos} cliente{c.clientesActivos !== 1 ? 's' : ''} activo{c.clientesActivos !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-3 text-sm">
              <div className="bg-surface-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-cream-muted inline-flex items-center gap-1 mb-1"><CalendarCheck2 size={11} /> Sesiones 1:1</p>
                <p className="text-lg font-bold text-cream tabular-nums">{c.sesiones}</p>
              </div>
              <div className="bg-surface-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-cream-muted inline-flex items-center gap-1 mb-1"><Users size={11} /> Entregados</p>
                <p className="text-lg font-bold text-cream tabular-nums">{c.entregados}</p>
              </div>
              <div className="bg-surface-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-cream-muted inline-flex items-center gap-1 mb-1"><TrendingUp size={11} /> Upsell</p>
                <p className="text-lg font-bold text-cream tabular-nums">{c.upsell} <span className="text-xs font-normal text-cream-muted">({c.tasaAscension.toFixed(0)}%)</span></p>
              </div>
              <div className="bg-surface-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-cream-muted inline-flex items-center gap-1 mb-1"><Award size={11} /> Casos de éxito</p>
                <p className="text-lg font-bold text-cream tabular-nums">{c.exitos}</p>
              </div>
              <div className="bg-surface-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-cream-muted inline-flex items-center gap-1 mb-1"><Star size={11} /> NPS promedio</p>
                <p className={`text-lg font-bold tabular-nums ${c.nps === null ? 'text-cream-muted' : ''}`} style={c.nps !== null ? { color: 'rgba(234,173,116,0.9)' } : undefined}>{c.nps !== null ? c.nps.toFixed(1) : '—'}</p>
              </div>
              <div className="bg-surface-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-cream-muted mb-1">Asistencia a clases</p>
                <p className="text-lg font-bold text-cream tabular-nums">{c.tasaAsistencia !== null ? `${c.tasaAsistencia.toFixed(0)}%` : '—'}</p>
              </div>
            </div>
          </div>
        ))}
        {coaches.length === 0 && (
          <p className="text-sm text-cream-muted">No hay Business Coach creados todavía.</p>
        )}
      </div>

      {/* Mentor por hiperfoco — quién dicta la clase grupal este mes (informativo) */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream mb-0.5">Mentor por hiperfoco · {formatMonthLong(csMesPeriodo)}</p>
        <p className="text-xs text-cream-muted mb-3">Quién dicta la clase grupal de cada hiperfoco este mes (informativo)</p>
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
                    {h.nps !== null && <> · <span style={{ color: 'rgba(234,173,116,0.9)' }}>NPS {h.nps.toFixed(1)}</span></>}
                  </p>
                </div>
                <HiperfocoMentorSelect hiperfocoId={h.id} periodo={csMesPeriodo} value={h.mentorId} options={mentorRosterActivos} />
              </div>
            ))}
          </div>
        )}
      </div>

      <MentorCrud mentores={((mentoresRaw as any[]) ?? []).map(m => ({ id: m.id, nombre: m.nombre, activo: m.activo }))} />
    </div>
  )
}
