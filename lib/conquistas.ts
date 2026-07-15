import type { createClient } from '@/lib/supabase/server'
import { mesesDesde } from '@/lib/format'

// Cálculo de "conquistas" / progreso del cliente a partir de datos que YA
// existen (2026-07-14, portal de progreso Fase 1). Reutilizado por la sección
// "Mi progreso" (detalle) y por el KPI de Inicio (resumen), para no duplicar la
// lógica. Recibe el client de servidor del propio usuario (RLS-scoped): cada
// tabla que consulta ya restringe a lo suyo (recording_progress "own",
// nps_responses own, coaching_notes own, user_hiperfoco_mes own).

type SupaClient = Awaited<ReturnType<typeof createClient>>

export interface ModuloVivido {
  hiperfocoId: string
  title: string
  activo: boolean // el hiperfoco más reciente del cliente está en_curso
  vistos: number
  total: number
}

export interface Conquistas {
  mesesActivo: number | null
  modulosVividos: number
  sesionesGrupales: number
  sesiones1a1: number
  sesionesTotales: number
  npsPromedio: number | null
  npsScores: number[] // orden cronológico ascendente
  modulos: ModuloVivido[]
}

export async function getConquistas(
  supabase: SupaClient,
  opts: { userId: string; productId: string | null; accessStarted: string | null | undefined },
): Promise<Conquistas> {
  const { userId, productId, accessStarted } = opts

  const [{ data: hfMes }, { data: attendance }, { data: notes }, { data: nps }] = await Promise.all([
    // Módulos vividos: hiperfocos con estado real (en_curso/cerrado), más reciente primero.
    productId
      ? supabase
          .from('user_hiperfoco_mes')
          .select('periodo, estado, hiperfoco_id, hiperfocos(title)')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .in('estado', ['en_curso', 'cerrado'])
          .order('periodo', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('live_session_attendance').select('id').eq('user_id', userId),
    supabase.from('coaching_notes').select('id').eq('user_id', userId),
    supabase.from('nps_responses').select('score, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
  ])

  // Deduplicar hiperfocos: una entrada por hiperfoco_id, quedándose con el estado
  // más reciente (la query ya viene desc, así que la primera aparición gana).
  const byHf = new Map<string, { title: string; activo: boolean }>()
  for (const r of ((hfMes as any[]) ?? [])) {
    if (!r.hiperfoco_id || byHf.has(r.hiperfoco_id)) continue
    const title = Array.isArray(r.hiperfocos) ? r.hiperfocos[0]?.title : r.hiperfocos?.title
    byHf.set(r.hiperfoco_id, { title: title ?? 'Módulo', activo: r.estado === 'en_curso' })
  }
  const hfIds = [...byHf.keys()]

  // Progreso de aprendizaje por hiperfoco: grabaciones vistas / publicadas.
  const totalPorHf = new Map<string, number>()
  const vistosPorHf = new Map<string, number>()
  if (hfIds.length) {
    const { data: recs } = await supabase
      .from('recordings')
      .select('id, hiperfoco_id')
      .in('hiperfoco_id', hfIds)
      .eq('is_published', true)
    const recList = ((recs as any[]) ?? [])
    const hfPorRec = new Map<string, string>()
    for (const rec of recList) {
      hfPorRec.set(rec.id, rec.hiperfoco_id)
      totalPorHf.set(rec.hiperfoco_id, (totalPorHf.get(rec.hiperfoco_id) ?? 0) + 1)
    }
    const recIds = recList.map(r => r.id)
    if (recIds.length) {
      const { data: prog } = await supabase
        .from('recording_progress')
        .select('recording_id, completed')
        .eq('user_id', userId)
        .in('recording_id', recIds)
      for (const p of ((prog as any[]) ?? [])) {
        if (!p.completed) continue
        const hf = hfPorRec.get(p.recording_id)
        if (hf) vistosPorHf.set(hf, (vistosPorHf.get(hf) ?? 0) + 1)
      }
    }
  }

  const modulos: ModuloVivido[] = hfIds.map(id => ({
    hiperfocoId: id,
    title: byHf.get(id)!.title,
    activo: byHf.get(id)!.activo,
    vistos: vistosPorHf.get(id) ?? 0,
    total: totalPorHf.get(id) ?? 0,
  }))

  const npsScores = ((nps as any[]) ?? []).map(n => Number(n.score))
  const npsPromedio = npsScores.length > 0
    ? Math.round((npsScores.reduce((a, b) => a + b, 0) / npsScores.length) * 10) / 10
    : null

  const sesionesGrupales = ((attendance as any[]) ?? []).length
  const sesiones1a1 = ((notes as any[]) ?? []).length

  return {
    mesesActivo: mesesDesde(accessStarted),
    modulosVividos: modulos.length,
    sesionesGrupales,
    sesiones1a1,
    sesionesTotales: sesionesGrupales + sesiones1a1,
    npsPromedio,
    npsScores,
    modulos,
  }
}
