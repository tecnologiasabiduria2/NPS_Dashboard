import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Respuestas a las preguntas cerradas de "retos" al iniciar un hiperfoco (punto 9
// Fase 2). Upsert por (user_id, hiperfoco_id, periodo). El texto de las preguntas
// vive en lib/retosPreguntas.ts (editable); aquí solo se guarda el mapa de valores.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.hiperfoco_id !== 'string' || !body.hiperfoco_id) {
    return NextResponse.json({ error: 'Falta el hiperfoco' }, { status: 400 })
  }
  const respuestas = (body.respuestas && typeof body.respuestas === 'object') ? body.respuestas : {}
  if (Object.keys(respuestas).length === 0) {
    return NextResponse.json({ error: 'Responde al menos una pregunta' }, { status: 400 })
  }

  const now = new Date()
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { error } = await supabaseAdmin
    .from('user_reto_hiperfoco')
    .upsert(
      { user_id: user.id, hiperfoco_id: body.hiperfoco_id, periodo, respuestas, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,hiperfoco_id,periodo' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
