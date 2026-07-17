import Link from 'next/link'
import { AlertTriangle, CalendarPlus, CalendarX } from 'lucide-react'
import { formatMonthLong } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { getClientesEnRiesgoAsistencia, RACHA_FALTAS_RIESGO, UMBRAL_ASISTENCIA } from '@/lib/attendanceRisk'
import MonthFilter from '../dashboard/MonthFilter'
import RiesgoMotivoFilter from './RiesgoMotivoFilter'

// ============================================================================
// CLIENTES — RESUMEN OPERATIVO. Página nueva (calibración 2026-07-07 noche):
// "Clientes sin 1:1" salió del dashboard general a esta página dedicada.
// "Mentor por hiperfoco" pasó por aquí también, pero se movió a
// /admin/business-coach el 2026-07-08 (es sobre la clase grupal del mes, no
// sobre operativa de clientes individuales). Se agrega "Clientes en riesgo
// por asistencia" (lib/attendanceRisk.ts, compartido con el KPI resumen del
// dashboard). "Requieren atención inmediata" (sin fecha o ya vencidos) se
// movió aquí desde el dashboard general el 2026-07-09 — el KPI "Resumen
// operativo" del dashboard enlaza a esta página, mismo patrón que NPS/Business
// Coach (resumen arriba, detalle acá).
// ============================================================================

function periodoKey(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function ClientesResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ cs_mes?: string; motivo?: string }>
}) {
  const { cs_mes: csMesParam, motivo: motivoFilter = '' } = await searchParams
  const supabase = await createClient()

  const csMesOptions = Array.from({ length: 6 }, (_, i) => {
    const p = periodoKey(-i)
    return { value: p.slice(0, 7), label: formatMonthLong(p) }
  })
  const csMesSel = csMesOptions.find(o => o.value === csMesParam)?.value ?? periodoKey(0).slice(0, 7)
  const csMesPeriodo = `${csMesSel}-01`
  const csMesPeriodoNextDate = new Date(`${csMesPeriodo}T00:00:00`)
  csMesPeriodoNextDate.setMonth(csMesPeriodoNextDate.getMonth() + 1)
  const csMesPeriodoNext = `${csMesPeriodoNextDate.getFullYear()}-${String(csMesPeriodoNextDate.getMonth() + 1).padStart(2, '0')}-01`

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: hiperfocos },
    { data: uhmMes },
    { data: sessions1x1Raw },
    { data: alerts },
  ] = await Promise.all([
    supabase.from('hiperfocos').select('id, title, products(title)'),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, hiperfoco_id, estado, cs_id')
      .eq('periodo', csMesPeriodo),
    supabase
      .from('coaching_notes')
      .select('user_id, admin_id, session_date')
      .gte('session_date', csMesPeriodo)
      .lt('session_date', csMesPeriodoNext),
    // "Requieren atención inmediata" — movido desde el dashboard general
    // (2026-07-09): clientes activos sin fecha de vencimiento o ya vencidos.
    supabase.from('user_access')
      .select('id, user_id, access_until, profiles(full_name), products(title)')
      .eq('status', 'active')
      .or(`access_until.is.null,access_until.lt.${today}`)
      .order('access_until', { ascending: true })
      .limit(8),
  ])

  const hfTitle = new Map<string, string>(
    ((hiperfocos as any[]) ?? []).map(h => [
      h.id,
      h.products?.title ? `${h.title} · ${h.products.title}` : h.title,
    ])
  )

  const uhmMesRows = (uhmMes as any[]) ?? []
  const uhmCSRows = uhmMesRows.filter(r => r.cs_id)
  const sessions1x1Rows = (sessions1x1Raw as any[]) ?? []
  const clientsWithSessionSet = new Set<string>(sessions1x1Rows.map((n: any) => n.user_id as string))
  const clientesSin1x1Rows = uhmCSRows.filter((r: any) => !clientsWithSessionSet.has(r.user_id as string))
  const clientIdsNeeded = [...new Set<string>([
    ...clientesSin1x1Rows.slice(0, 30).map((r: any) => r.user_id as string),
    ...uhmCSRows.map((r: any) => r.cs_id as string),
  ])]

  const profileMap = new Map<string, string>()
  if (clientIdsNeeded.length > 0) {
    const { data: profData } = await supabase.from('profiles').select('id, full_name').in('id', clientIdsNeeded)
    for (const p of (profData ?? []) as any[]) profileMap.set(p.id, p.full_name ?? '—')
  }

  const totalSin1x1 = clientesSin1x1Rows.length
  const clientesSin1x1 = clientesSin1x1Rows.slice(0, 10).map((r: any) => ({
    userId: r.user_id as string,
    name: profileMap.get(r.user_id as string) ?? '—',
    csId: r.cs_id as string,
    csName: profileMap.get(r.cs_id as string) ?? '—',
  }))

  // --- Clientes en riesgo por asistencia (lib/attendanceRisk.ts, compartido) ---
  const riesgoRaw = await getClientesEnRiesgoAsistencia()
  const nombresFaltantes = [...new Set(riesgoRaw.map(r => r.userId))].filter(id => !profileMap.has(id))
  if (nombresFaltantes.length > 0) {
    const { data: extra } = await supabase.from('profiles').select('id, full_name').in('id', nombresFaltantes)
    for (const p of (extra as any[]) ?? []) profileMap.set(p.id, p.full_name ?? '—')
  }
  const clientesEnRiesgo = riesgoRaw
    .filter(r => !motivoFilter || r.motivos.includes(motivoFilter as 'racha' | 'porcentaje'))
    .map(r => ({
      userId: r.userId,
      name: profileMap.get(r.userId) ?? '—',
      hiperfoco: hfTitle.get(r.hiperfocoId) ?? '—',
      motivo: r.motivo,
    }))

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Clientes — resumen operativo</h1>
          <p className="page-subtitle">Riesgo de asistencia y clientes sin 1:1</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-cream-dim">{formatMonthLong(csMesPeriodo)}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <MonthFilter value={csMesSel} options={csMesOptions} />
        </div>
      </div>

      {/* Requieren atención inmediata — primero (movido desde el dashboard
          general, 2026-07-09): sin fecha de vencimiento o ya vencidos. */}
      {alerts && alerts.length > 0 && (
        <div className="card mb-4 border-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-400 shrink-0" />
              <p className="text-sm font-medium text-red-400">Requieren atención inmediata</p>
            </div>
            <Link href="/admin/clients" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-surface-700">
            {(alerts as any[]).map((a: any) => (
              <Link key={a.id} href={`/admin/clients/${a.user_id}`}>
                <div className="flex items-center justify-between py-3 hover:bg-surface-800/50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center">
                      <span className="text-xs text-cream-muted font-medium">
                        {(a.profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-cream font-medium">{a.profiles?.full_name ?? '—'}</p>
                      <p className="text-xs text-cream-muted">{a.products?.title}</p>
                    </div>
                  </div>
                  <span className={a.access_until ? 'badge-inactive' : 'badge-warning'}>
                    {a.access_until ? 'Vencido' : 'Sin fecha'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Clientes en riesgo por asistencia — segundo (pedido de Juan, 2026-07-07 noche) */}
      <div className="card mb-4" style={{ borderColor: clientesEnRiesgo.length > 0 ? 'rgba(226,75,74,0.2)' : undefined }}>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarX size={15} className={clientesEnRiesgo.length > 0 ? 'text-red-400 shrink-0' : 'text-cream-muted shrink-0'} />
            <p className={`text-sm font-medium ${clientesEnRiesgo.length > 0 ? 'text-red-400' : 'text-cream'}`}>Clientes en riesgo por asistencia</p>
          </div>
          <RiesgoMotivoFilter value={motivoFilter} />
        </div>
        <p className="text-xs text-cream-muted mb-3">
          Faltó a las últimas {RACHA_FALTAS_RIESGO}+ sesiones seguidas de su hiperfoco, o su asistencia es menor al {Math.round(UMBRAL_ASISTENCIA * 100)}%
        </p>
        {clientesEnRiesgo.length === 0 ? (
          <p className="text-sm text-cream-muted">
            {motivoFilter ? 'Nadie coincide con ese filtro.' : 'Nadie en riesgo por asistencia en este momento.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {clientesEnRiesgo.map(c => (
              <div key={c.userId} className="grid grid-cols-[1fr_auto] gap-3 text-sm items-center bg-surface-800 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/admin/clients/${c.userId}`} className="text-cream hover:text-brand-400 transition-colors truncate">
                    {c.name}
                  </Link>
                  <p className="text-xs text-cream-muted truncate">{c.hiperfoco} · {c.motivo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clientes sin 1:1 — segundo */}
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
                <Link href={`/admin/clients/${c.userId}`} className="min-w-0 text-cream hover:text-brand-400 transition-colors truncate">
                  {c.name}
                </Link>
                <span className="min-w-0 text-cream-muted text-xs truncate">{c.csName}</span>
                <Link
                  href={`/admin/clients/${c.userId}#sesiones-1-1`}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-brand-600/15 text-brand-300 hover:bg-brand-600/25 transition-colors whitespace-nowrap"
                >
                  <CalendarPlus size={12} /> Agendar 1:1
                </Link>
              </div>
            ))}
            {totalSin1x1 > 10 && (
              <p className="text-xs text-cream-muted pt-1">+ {totalSin1x1 - 10} más</p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
