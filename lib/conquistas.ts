import type { createClient } from '@/lib/supabase/server'
import type { LucideIcon } from 'lucide-react'
import { GraduationCap, Flame, Video as VideoIcon, MessageSquare, CalendarCheck } from 'lucide-react'
import { mesesDesde, CO_TZ } from '@/lib/format'

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
  rachaSemanas: number
}

// Lunes de la semana de una fecha, como clave YYYY-MM-DD — en hora Colombia
// (2026-07-16, fix), no en la hora local del proceso donde corre este código.
// El servidor (VPS en prod) corre en UTC; sin esto, entre ~7pm y medianoche
// hora Colombia el cálculo podía "adelantarse" un día y mandar una racha al
// bucket de semana equivocado. Se saca primero la fecha calendario de
// Colombia (inmune al TZ del proceso), y luego se ancla a mediodía UTC para
// hacer la aritmética de día-de-semana sin más sorpresas de huso horario —
// mismo criterio (CO_TZ) que ya usa el resto de la app para sesiones en vivo.
function mondayOf(d: Date): string {
  const coDate = d.toLocaleDateString('en-CA', { timeZone: CO_TZ }) // 'YYYY-MM-DD'
  const [y, m, day] = coDate.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, day, 12))
  const dow = (anchor.getUTCDay() + 6) % 7 // 0 = lunes
  anchor.setUTCDate(anchor.getUTCDate() - dow)
  return anchor.toISOString().slice(0, 10)
}

// Racha (2026-07-15, sugerencias post-portal): semanas consecutivas contando
// hacia atrás desde la semana actual con al menos 1 grabación completada
// (cualquier hiperfoco o transversal, por eso se calcula sobre TODO
// recording_progress del usuario, no solo el de sus hiperfocos asignados).
function calcRachaSemanas(updatedAts: string[]): number {
  const weeks = new Set(updatedAts.map(d => mondayOf(new Date(d))))
  let streak = 0
  const cursor = new Date()
  while (weeks.has(mondayOf(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

export interface Insignia {
  id: string
  label: string
  icon: LucideIcon
  unlocked: boolean
  requirement: string // criterio de desbloqueo, visible al usuario (2026-07-16)
  progressLabel?: string // ej. "3/10 sesiones", solo para insignias con avance numérico
}

// Insignias (2026-07-15): calculadas en vivo a partir de Conquistas, sin tabla
// ni queries nuevas — primer set propuesto, ajustable con Juan tras verlas.
// Cada una trae su criterio en texto plano (2026-07-16, pedido de Juan: el
// cliente debe poder ver de forma sutil qué le falta, no solo un candado).
export function getInsignias(c: Conquistas): Insignia[] {
  return [
    {
      id: 'primer_modulo', label: 'Primer módulo completado', icon: GraduationCap,
      unlocked: c.modulos.some(m => !m.activo),
      requirement: 'Termina (cierra) tu primer hiperfoco',
    },
    {
      id: 'racha_4', label: 'Racha de 4 semanas', icon: Flame,
      unlocked: c.rachaSemanas >= 4,
      requirement: '4 semanas seguidas viendo contenido',
      progressLabel: `${Math.min(c.rachaSemanas, 4)}/4 semanas`,
    },
    {
      id: 'diez_sesiones', label: '10 sesiones vividas', icon: VideoIcon,
      unlocked: c.sesionesTotales >= 10,
      requirement: '10 sesiones en vivo o mentorías 1:1',
      progressLabel: `${Math.min(c.sesionesTotales, 10)}/10 sesiones`,
    },
    {
      id: 'voz_escuchada', label: 'Voz escuchada', icon: MessageSquare,
      unlocked: c.npsScores.length >= 1,
      requirement: 'Califica al menos 1 sesión (NPS)',
    },
    {
      id: 'meses_fiel', label: 'Meses fiel', icon: CalendarCheck,
      unlocked: (c.mesesActivo ?? 0) >= 6,
      requirement: '6 meses activo en la plataforma',
      progressLabel: `${Math.min(c.mesesActivo ?? 0, 6)}/6 meses`,
    },
  ]
}

export async function getConquistas(
  supabase: SupaClient,
  opts: { userId: string; productId: string | null; accessStarted: string | null | undefined },
): Promise<Conquistas> {
  const { userId, productId, accessStarted } = opts

  const [{ data: hfMes }, { data: attendance }, { data: notes }, { data: nps }, { data: progressDates }] = await Promise.all([
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
    supabase.from('recording_progress').select('updated_at').eq('user_id', userId).eq('completed', true),
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
  const rachaSemanas = calcRachaSemanas(((progressDates as any[]) ?? []).map(p => p.updated_at))

  return {
    mesesActivo: mesesDesde(accessStarted),
    modulosVividos: modulos.length,
    sesionesGrupales,
    sesiones1a1,
    sesionesTotales: sesionesGrupales + sesiones1a1,
    npsPromedio,
    npsScores,
    modulos,
    rachaSemanas,
  }
}
