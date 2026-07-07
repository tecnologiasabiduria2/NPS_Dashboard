import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Mentor que dicta un hiperfoco en un mes dado — puramente informativo (quién
// da la clase grupal). Corregido 2026-07-07 noche: el mentor NO tiene cuenta
// ni hace la 1:1 (eso lo hace el Business Coach, vía cs_id independiente) —
// se quitó la propagación a user_hiperfoco_mes.cs_id que tenía antes. Solo el
// owner (Diana) lo edita — mismo patrón que /api/admin/settings (CsTargetEditor).
export async function POST(req: NextRequest) {
  const auth = await requireOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const hiperfoco_id: string | undefined = body?.hiperfoco_id
  const periodo: string | undefined = body?.periodo
  const mentor_id: string | undefined = body?.mentor_id

  if (!hiperfoco_id || !periodo) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  if (!mentor_id) {
    // "" = quitar asignación
    const { error } = await supabaseAdmin
      .from('hiperfoco_mentor_mes')
      .delete()
      .eq('hiperfoco_id', hiperfoco_id)
      .eq('periodo', periodo)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, cleared: true })
  }

  const { error } = await supabaseAdmin
    .from('hiperfoco_mentor_mes')
    .upsert(
      { hiperfoco_id, periodo, mentor_id, updated_at: new Date().toISOString() },
      { onConflict: 'hiperfoco_id,periodo' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
