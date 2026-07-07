import Link from 'next/link'
import { AlertTriangle, CalendarPlus } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import ProductFilter from './ProductFilter'
import CsTargetEditor from './CsTargetEditor'
import MonthFilter from './MonthFilter'
import CsFilter from './CsFilter'
import HiperfocoMentorSelect from './HiperfocoMentorSelect'

// ============================================================================
// OPERACIÓN CS — visible para cualquier admin (no solo owner). Antes vivía
// dentro de OwnerOpsSection; se separó (calibración 2026-07-07) porque Lorena
// (admin, no owner) es quien agenda las 1:1 y necesita ver "Clientes sin 1:1"
// y "Mentor por hiperfoco" sin ser owner. Lo puramente de negocio (KPIs,
// insights, upsell, Salud por CS) se quedó en OwnerOpsSection (solo owner).
// ============================================================================

function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function CsOpsSection({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string; cs_mes?: string; cs?: string }>
}) {
  const { producto: productoFilter = '', cs_mes: csMesParam, cs: csFilterParam = '' } = await searchParams
  const supabase = await createClient()

  const { data: csTargetRow } = await supabaseAdmin
    .from('platform_settings').select('value').eq('key', 'cs_session_target_monthly').maybeSingle()
  const csTarget = Number(csTargetRow?.value) || 20

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
    { data: hiperfocos },
    { data: uhmMes },
    { data: sessions1x1Raw },
    { data: mentoresMes },
    { data: npsRows },
    { data: rosterRaw },
  ] = await Promise.all([
    supabase.from('hiperfocos').select('id, title, is_active, products(slug, title)'),
    // todo el estado del mes seleccionado (para mentor-por-hiperfoco y CS asignado)
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, hiperfoco_id, estado, cs_id')
      .eq('periodo', csMesPeriodo),
    supabase
      .from('coaching_notes')
      .select('user_id, admin_id, session_date')
      .gte('session_date', csMesPeriodo)
      .lt('session_date', csMesPeriodoNext),
    supabaseAdmin.from('hiperfoco_mentor_mes').select('hiperfoco_id, mentor_id').eq('periodo', csMesPeriodo),
    supabase.from('nps_responses').select('user_id, score, created_at, hiperfoco_id').limit(2000),
    // roster de mentores/CS reales (no derivado de asignaciones) — admin y owner.
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'owner']).order('full_name'),
  ])

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

  const uhmMesRows = (uhmMes as any[]) ?? []
  const uhmCSRows = uhmMesRows.filter(r => r.cs_id)
  const sessions1x1Rows = (sessions1x1Raw as any[]) ?? []
  const clientsWithSessionSet = new Set<string>(sessions1x1Rows.map((n: any) => n.user_id as string))
  const csIds = [...new Set<string>(uhmCSRows.map((r: any) => r.cs_id as string))]
  const clientesSin1x1Rows = uhmCSRows.filter((r: any) => !clientsWithSessionSet.has(r.user_id as string))
  const clientIdsNeeded = clientesSin1x1Rows.slice(0, 30).map((r: any) => r.user_id as string)

  const roster = ((rosterRaw as any[]) ?? []).map(p => ({ id: p.id as string, name: p.full_name as string }))
  const rosterMap = new Map<string, string>(roster.map(r => [r.id, r.name]))

  const profileIdsNeeded = [...new Set<string>(clientIdsNeeded)]
  const profileMap = new Map<string, string>(rosterMap)
  if (profileIdsNeeded.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIdsNeeded)
    for (const p of (profData ?? []) as any[]) profileMap.set(p.id, p.full_name ?? '—')
  }

  const sessionsByCS = new Map<string, number>()
  for (const n of sessions1x1Rows) {
    if (n.admin_id) sessionsByCS.set(n.admin_id, (sessionsByCS.get(n.admin_id) ?? 0) + 1)
  }
  const clientsByCS = new Map<string, number>()
  for (const r of uhmCSRows) clientsByCS.set(r.cs_id, (clientsByCS.get(r.cs_id) ?? 0) + 1)

  const csList = csIds.map(id => ({
    id,
    name: profileMap.get(id) ?? rosterMap.get(id) ?? '—',
    clientes: clientsByCS.get(id) ?? 0,
    sesiones: sessionsByCS.get(id) ?? 0,
  })).sort((a, b) => b.sesiones - a.sesiones)

  const csFilterSel = csList.some(cs => cs.id === csFilterParam) ? csFilterParam : ''
  const csListFiltered = csFilterSel ? csList.filter(cs => cs.id === csFilterSel) : csList

  const totalSin1x1 = clientesSin1x1Rows.length
  const clientesSin1x1 = clientesSin1x1Rows.slice(0, 10).map((r: any) => ({
    userId: r.user_id as string,
    name: profileMap.get(r.user_id as string) ?? '—',
    csId: r.cs_id as string,
    csName: profileMap.get(r.cs_id as string) ?? '—',
  }))

  // --- Mentor por hiperfoco: clientes en curso ese hiperfoco+mes + NPS del mes.
  const mentorByHf = new Map<string, string>(
    ((mentoresMes as any[]) ?? []).map(m => [m.hiperfoco_id as string, m.mentor_id as string])
  )
  const clientesPorHf = new Map<string, Set<string>>()
  for (const row of uhmMesRows) {
    if (row.estado !== 'en_curso' || !row.hiperfoco_id) continue
    if (!clientesPorHf.has(row.hiperfoco_id)) clientesPorHf.set(row.hiperfoco_id, new Set())
    clientesPorHf.get(row.hiperfoco_id)!.add(row.user_id)
  }
  const npsPorHf = new Map<string, { sum: number; count: number }>()
  for (const r of (npsRows as any[]) ?? []) {
    if (!r.hiperfoco_id || String(r.created_at).slice(0, 7) !== csMesSel) continue
    const d = npsPorHf.get(r.hiperfoco_id) ?? { sum: 0, count: 0 }
    d.sum += Number(r.score); d.count++
    npsPorHf.set(r.hiperfoco_id, d)
  }
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

  const npsColor = (v: number) => (v >= 8 ? 'text-emerald-400' : v >= 6 ? 'text-amber-400' : 'text-red-400')

  return (
    <div className="mt-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cream-dim">Operación CS</p>
          <p className="text-xs text-cream-muted mt-0.5">{formatMonthLong(csMesPeriodo)}</p>
        </div>
        {productOptions.length > 1 && (
          <ProductFilter options={productOptions} value={productoFilter} />
        )}
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

      {/* Mentor por hiperfoco — quien dicta cada hiperfoco este mes ES quien
          hace las 1:1 de esos clientes (calibración 2026-07-07). */}
      <div className="card mb-4">
        <p className="text-sm font-medium text-cream mb-0.5">Mentor por hiperfoco · {formatMonthLong(csMesPeriodo)}</p>
        <p className="text-xs text-cream-muted mb-3">Quién dicta cada hiperfoco este mes — es también quien hace las 1:1 de esos clientes</p>
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
                  options={roster}
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
            <div className="grid grid-cols-[1fr_120px_auto] gap-3 text-xs text-cream-muted pb-2 border-b border-surface-700">
              <span>Cliente</span>
              <span>CS responsable</span>
              <span />
            </div>
            {clientesSin1x1.map(c => (
              <div key={c.userId} className="grid grid-cols-[1fr_120px_auto] gap-3 text-sm items-center">
                <Link href={`/admin/clients/${c.userId}`} className="text-cream hover:text-brand-400 transition-colors truncate">
                  {c.name}
                </Link>
                <span className="text-cream-muted text-xs truncate">{c.csName}</span>
                <Link
                  href={`/admin/clients/${c.userId}#sesiones-1-1`}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-brand-600/15 text-brand-300 hover:bg-brand-600/25 transition-colors whitespace-nowrap"
                >
                  <CalendarPlus size={12} /> Agendar 1:1
                </Link>
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
    </div>
  )
}
