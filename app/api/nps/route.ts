import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NpsTrigger, NpsType } from '@/types'

// El eje del disparador (trigger = CUÁNDO) determina el tipo de pregunta
// (type = QUÉ). No se confía en el cliente para el type.
const TYPE_BY_TRIGGER: Record<NpsTrigger, NpsType> = {
  post_sesion: 'mejora_sesion',
  semanal: 'interes_ascension',
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

  const { error } = await supabase.from('nps_responses').insert({
    user_id: user.id,
    score,
    feedback,
    type: TYPE_BY_TRIGGER[trigger],
    trigger,
    // El índice único de post-sesión usa (user_id, live_session_id); en semanal va NULL.
    live_session_id: trigger === 'post_sesion' ? live_session_id : null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
