import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { NpsTrigger, NpsType } from '@/types'

// El eje del disparador (trigger = CUÁNDO) determina el tipo de pregunta
// (type = QUÉ). No se confía en el cliente para el type.
const TYPE_BY_TRIGGER: Record<NpsTrigger, NpsType> = {
  post_sesion: 'mejora_sesion',
  semanal: 'interes_ascension',
}

// Primer día (UTC) del mes de una fecha dada, en formato YYYY-MM-DD.
function firstOfMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Deriva el hiperfoco al que corresponde una respuesta NPS (Bloque 2).
 * - post_sesion: mes + producto de la sesión asistida → user_hiperfoco_mes.
 * - semanal:     mes en curso → hiperfoco vigente del cliente.
 * Devuelve null si el cliente no tenía hiperfoco asignado ese mes
 * (la respuesta igual se guarda; se reporta como "Sin hiperfoco").
 */
async function deriveHiperfocoId(
  supabase: SupabaseClient,
  userId: string,
  trigger: NpsTrigger,
  liveSessionId: string | null
): Promise<string | null> {
  if (trigger === 'post_sesion' && liveSessionId) {
    const { data: session } = await supabase
      .from('live_sessions')
      .select('product_id, starts_at')
      .eq('id', liveSessionId)
      .maybeSingle()

    if (!session) return null

    const { data: row } = await supabase
      .from('user_hiperfoco_mes')
      .select('hiperfoco_id')
      .eq('user_id', userId)
      .eq('product_id', session.product_id)
      .eq('periodo', firstOfMonth(new Date(session.starts_at)))
      .not('hiperfoco_id', 'is', null)
      .maybeSingle()

    return row?.hiperfoco_id ?? null
  }

  // semanal → hiperfoco del mes en curso (cualquier producto activo).
  const { data: row } = await supabase
    .from('user_hiperfoco_mes')
    .select('hiperfoco_id')
    .eq('user_id', userId)
    .eq('periodo', firstOfMonth(new Date()))
    .not('hiperfoco_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return row?.hiperfoco_id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const score = Number(body?.score)
  const trigger: NpsTrigger = body?.trigger
  const feedback: string | null = body?.feedback?.trim() || null
  const live_session_id: string | null = body?.live_session_id ?? null

  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return NextResponse.json({ error: 'Score inválido (1-10)' }, { status: 400 })
  }
  if (trigger !== 'post_sesion' && trigger !== 'semanal') {
    return NextResponse.json({ error: 'Trigger inválido' }, { status: 400 })
  }

  const sessionId = trigger === 'post_sesion' ? live_session_id : null
  const hiperfoco_id = await deriveHiperfocoId(supabase, user.id, trigger, sessionId)

  const { error } = await supabase.from('nps_responses').insert({
    user_id: user.id,
    score,
    feedback,
    type: TYPE_BY_TRIGGER[trigger],
    trigger,
    // El índice único de post-sesión usa (user_id, live_session_id); en semanal va NULL.
    live_session_id: sessionId,
    hiperfoco_id,
  })

  if (error) {
    // Ya calificó esta sesión (índice único user+sesión) → idempotente.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, already: true })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
