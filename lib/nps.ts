import type { SupabaseClient } from '@supabase/supabase-js'
import type { NpsTrigger } from '@/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface NpsCopy {
  eyebrow: string
  title: string // puede contener el token {sesion} (solo post_sesion)
  question: string
}

// Textos por defecto del modal NPS. Son el fallback si la tabla nps_questions
// está vacía, y el seed de la migración del Bloque 2.
export const DEFAULT_NPS_COPY: Record<NpsTrigger, NpsCopy> = {
  post_sesion: {
    eyebrow: 'Después de tu sesión en vivo',
    title: '¿Cómo estuvo «{sesion}»?',
    question: '¿Qué tan probable es que recomiendes esta sesión a otro empresario?',
  },
  semanal: {
    eyebrow: 'Seguimiento semanal',
    title: '¿Cómo vas con tu proceso?',
    question: '¿Qué tan probable es que recomiendes Sabiduría Empresarial a un colega?',
  },
}

/** Lee los textos configurados de un disparador, con fallback a los por defecto. */
async function fetchNpsCopy(
  supabase: SupabaseClient,
  trigger: NpsTrigger
): Promise<NpsCopy> {
  const { data } = await supabase
    .from('nps_questions')
    .select('eyebrow, title, question')
    .eq('trigger', trigger)
    .maybeSingle()

  const def = DEFAULT_NPS_COPY[trigger]
  if (!data) return def
  return {
    eyebrow: data.eyebrow ?? def.eyebrow,
    title: data.title ?? def.title,
    question: data.question ?? def.question,
  }
}

export interface NpsPrompt {
  trigger: NpsTrigger
  // Sólo presente cuando trigger === 'post_sesion'
  sessionId?: string
  sessionTitle?: string
  copy: NpsCopy
}

/**
 * Decide si al cliente le corresponde ver el modal de NPS y por cuál eje.
 *
 * Prioridad:
 *  1. post_sesion — existe una sesión EN VIVO a la que asistió, que YA terminó
 *     (now() > ends_at) y que aún no ha calificado.
 *  2. semanal     — control macro: no respondió un NPS semanal en los últimos 7 días.
 *
 * Devuelve null si no corresponde mostrar nada.
 */
export async function getNpsPrompt(
  supabase: SupabaseClient,
  userId: string
): Promise<NpsPrompt | null> {
  const nowIso = new Date().toISOString()
  // Solo considerar sesiones que terminaron en los últimos 14 días para evitar
  // disparar NPS por asistencias antiguas o registros de prueba.
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // --- 1. post_sesion ---
  // Sesiones asistidas que ya terminaron (RLS las limita a las del usuario).
  const { data: attended } = await supabase
    .from('live_session_attendance')
    .select('session_id, live_sessions!inner(id, title, ends_at)')
    .eq('user_id', userId)
    .lt('live_sessions.ends_at', nowIso)
    .gt('live_sessions.ends_at', twoWeeksAgo)
    .order('joined_at', { ascending: false })
    .limit(20)

  if (attended && attended.length > 0) {
    // Sesiones ya calificadas por post-sesión.
    const { data: answered } = await supabase
      .from('nps_responses')
      .select('live_session_id')
      .eq('user_id', userId)
      .eq('trigger', 'post_sesion')
      .not('live_session_id', 'is', null)

    const answeredSet = new Set((answered ?? []).map((a) => a.live_session_id))
    const pending = attended.find((a) => !answeredSet.has(a.session_id))

    if (pending) {
      const ls = (pending as any).live_sessions
      return {
        trigger: 'post_sesion',
        sessionId: pending.session_id,
        sessionTitle: ls?.title ?? 'tu última sesión',
        copy: await fetchNpsCopy(supabase, 'post_sesion'),
      }
    }
  }

  // --- 2. semanal ---
  // Gracia de 7 días: no pedir NPS semanal a alguien que acaba de crear su cuenta.
  const { data: accessRow } = await supabase
    .from('user_access')
    .select('access_started, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const startDate = accessRow?.access_started ?? accessRow?.created_at
  if (startDate && Date.now() - new Date(startDate).getTime() < WEEK_MS) {
    return null
  }

  const { data: lastWeekly } = await supabase
    .from('nps_responses')
    .select('created_at')
    .eq('user_id', userId)
    .eq('trigger', 'semanal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const due =
    !lastWeekly ||
    Date.now() - new Date(lastWeekly.created_at).getTime() > WEEK_MS

  if (due) return { trigger: 'semanal', copy: await fetchNpsCopy(supabase, 'semanal') }

  return null
}
