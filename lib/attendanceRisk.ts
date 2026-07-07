import { createClient } from '@/lib/supabase/server'

// Clientes en riesgo por falta de asistencia (calibración 2026-07-07 noche):
// en riesgo si faltó a las últimas RACHA_FALTAS_RIESGO sesiones seguidas de su
// hiperfoco en curso, O su asistencia es < UMBRAL_ASISTENCIA. El umbral del
// 70% ya se había definido antes (PENDIENTES.md B7, reunión 2026-06-22:
// "alerta al 70% de asistencia") — corregido aquí, se había puesto 50% sin
// revisar esa decisión previa. "Grabación vista" como métrica separada (la
// otra mitad de B7) queda pendiente, tal como estaba entonces. Compartido
// entre /admin/clientes-resumen (detalle) y el KPI resumen de /admin/dashboard.
export const MIN_SESIONES_PARA_PORCENTAJE = 2
export const RACHA_FALTAS_RIESGO = 2
export const UMBRAL_ASISTENCIA = 0.7

export type MotivoRiesgo = 'racha' | 'porcentaje'

export interface ClienteEnRiesgo {
  userId: string
  hiperfocoId: string
  motivos: MotivoRiesgo[]
  motivo: string
}

export async function getClientesEnRiesgoAsistencia(): Promise<ClienteEnRiesgo[]> {
  const supabase = await createClient()

  const [
    { data: activos },
    { data: uhmMes },
    { data: hiperfocos },
    { data: pastSessions },
  ] = await Promise.all([
    supabase.from('user_access').select('user_id').eq('status', 'active'),
    supabase
      .from('user_hiperfoco_mes')
      .select('user_id, hiperfoco_id, estado')
      .eq('periodo', `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`)
      .eq('estado', 'en_curso'),
    supabase.from('hiperfocos').select('id, title'),
    supabase
      .from('live_sessions')
      .select('id, hiperfoco_nombre, starts_at, ends_at')
      .lt('ends_at', new Date().toISOString())
      .not('hiperfoco_nombre', 'is', null)
      .order('starts_at', { ascending: false })
      .limit(500),
  ])

  const activeIds = new Set<string>(((activos as any[]) ?? []).map(r => r.user_id))
  const hfRawTitle = new Map<string, string>(((hiperfocos as any[]) ?? []).map(h => [h.id, h.title]))
  const clientesConHiperfoco = ((uhmMes as any[]) ?? [])
    .filter(r => activeIds.has(r.user_id))
    .map(r => [r.user_id as string, r.hiperfoco_id as string] as const)

  const sessionsByRawTitle = new Map<string, { id: string; starts_at: string }[]>()
  for (const s of (pastSessions as any[]) ?? []) {
    const key = s.hiperfoco_nombre as string
    if (!sessionsByRawTitle.has(key)) sessionsByRawTitle.set(key, [])
    sessionsByRawTitle.get(key)!.push({ id: s.id, starts_at: s.starts_at })
  }

  const relevantSessionIds = new Set<string>()
  for (const [, hfId] of clientesConHiperfoco) {
    const raw = hfRawTitle.get(hfId)
    if (raw) for (const s of sessionsByRawTitle.get(raw) ?? []) relevantSessionIds.add(s.id)
  }

  const attendanceMap = new Map<string, Set<string>>()
  if (relevantSessionIds.size > 0 && clientesConHiperfoco.length > 0) {
    const { data: attendanceRows } = await supabase
      .from('live_session_attendance')
      .select('user_id, session_id')
      .in('session_id', [...relevantSessionIds])
      .in('user_id', clientesConHiperfoco.map(([uid]) => uid))
    for (const a of (attendanceRows as any[]) ?? []) {
      if (!attendanceMap.has(a.user_id)) attendanceMap.set(a.user_id, new Set())
      attendanceMap.get(a.user_id)!.add(a.session_id)
    }
  }

  const result: ClienteEnRiesgo[] = []
  for (const [uid, hfId] of clientesConHiperfoco) {
    const raw = hfRawTitle.get(hfId)
    if (!raw) continue
    const sessions = (sessionsByRawTitle.get(raw) ?? []).slice().sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    if (sessions.length === 0) continue
    const attended = attendanceMap.get(uid) ?? new Set()

    let rachaFaltas = 0
    for (const s of sessions) {
      if (attended.has(s.id)) break
      rachaFaltas++
    }
    const asistidas = sessions.filter(s => attended.has(s.id)).length
    const tasa = asistidas / sessions.length

    const motivos: MotivoRiesgo[] = []
    const textos: string[] = []
    if (rachaFaltas >= RACHA_FALTAS_RIESGO) {
      motivos.push('racha')
      textos.push(`faltó a las últimas ${rachaFaltas} sesiones seguidas`)
    }
    if (sessions.length >= MIN_SESIONES_PARA_PORCENTAJE && tasa < UMBRAL_ASISTENCIA) {
      motivos.push('porcentaje')
      textos.push(`asistencia del ${Math.round(tasa * 100)}%`)
    }
    if (motivos.length > 0) {
      result.push({ userId: uid, hiperfocoId: hfId, motivos, motivo: textos.join(' · ') })
    }
  }
  return result
}
