import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// NPS público por LINK (Bloque 5b). No requiere sesión: se inserta con el
// service role (sin RLS). El cliente es opcional — si deja su email y calza con
// un usuario, se atribuye; si no, queda anónimo (igual promedia por sesión).

function firstOfMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token: string | undefined = body?.token
  const score = Number(body?.score)
  const feedback: string | null = body?.feedback?.trim() || null
  const email: string | null = body?.email?.trim() || null

  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return NextResponse.json({ error: 'Calificación inválida (1-10)' }, { status: 400 })
  }

  // Sesión por token (service role → sin RLS).
  const { data: session } = await supabaseAdmin
    .from('live_sessions')
    .select('id, product_id, starts_at')
    .eq('nps_token', token)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'Link inválido o vencido' }, { status: 404 })

  // Atribución por email (opcional).
  let userId: string | null = null
  if (email) {
    const { data: matched } = await supabaseAdmin.rpc('nps_match_user', { p_email: email })
    userId = (matched as string | null) ?? null
  }

  // Hiperfoco: solo si sabemos el cliente (es por usuario-mes). Anónimo → null.
  let hiperfocoId: string | null = null
  if (userId) {
    const { data: row } = await supabaseAdmin
      .from('user_hiperfoco_mes')
      .select('hiperfoco_id')
      .eq('user_id', userId)
      .eq('product_id', session.product_id)
      .eq('periodo', firstOfMonth(new Date(session.starts_at)))
      .not('hiperfoco_id', 'is', null)
      .maybeSingle()
    hiperfocoId = row?.hiperfoco_id ?? null
  }

  const { error } = await supabaseAdmin.from('nps_responses').insert({
    user_id: userId,
    score,
    feedback,
    type: 'mejora_sesion',
    trigger: 'post_sesion',
    live_session_id: session.id,
    hiperfoco_id: hiperfocoId,
    respondent_email: email,
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
