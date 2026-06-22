import type { SupabaseClient } from '@supabase/supabase-js'
import type { NpsTrigger } from '@/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface NpsPrompt {
  trigger: NpsTrigger
  // Sólo presente cuando trigger === 'post_sesion'
  sessionId?: string
  sessionTitle?: string
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

  // --- 1. post_sesion ---
  // Sesiones asistidas que ya terminaron (RLS las limita a las del usuario).
  const { data: attended } = await supabase
    .from('live_session_attendance')
    .select('session_id, live_sessions!inner(id, title, ends_at)')
    .eq('user_id', userId)
    .lt('live_sessions.ends_at', nowIso)
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
      }
    }
  }

  // --- 2. semanal ---
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

  if (due) return { trigger: 'semanal' }

  return null
}
