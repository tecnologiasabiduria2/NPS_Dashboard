import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Mentor que dicta un hiperfoco en un mes dado. Es la MISMA persona que hace
// las 1:1 de los clientes en ese hiperfoco ese mes (calibración 2026-07-07),
// así que asignar/cambiar mentor aquí propaga cs_id a todos los clientes con
// ese hiperfoco en curso ese mes. Solo el owner (Diana) lo edita — mismo
// patrón que /api/admin/settings (CsTargetEditor).
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
    // "" = quitar asignación → también se limpia el cs_id que había propagado.
    const { error } = await supabaseAdmin
      .from('hiperfoco_mentor_mes')
      .delete()
      .eq('hiperfoco_id', hiperfoco_id)
      .eq('periodo', periodo)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await supabaseAdmin
      .from('user_hiperfoco_mes')
      .update({ cs_id: null })
      .eq('hiperfoco_id', hiperfoco_id)
      .eq('periodo', periodo)
      .eq('estado', 'en_curso')

    return NextResponse.json({ ok: true, cleared: true })
  }

  const { error } = await supabaseAdmin
    .from('hiperfoco_mentor_mes')
    .upsert(
      { hiperfoco_id, periodo, mentor_id, updated_at: new Date().toISOString() },
      { onConflict: 'hiperfoco_id,periodo' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Propagar: todos los clientes con este hiperfoco en curso ese mes quedan
  // con este mentor como su cs_id (responsable de la 1:1).
  await supabaseAdmin
    .from('user_hiperfoco_mes')
    .update({ cs_id: mentor_id })
    .eq('hiperfoco_id', hiperfoco_id)
    .eq('periodo', periodo)
    .eq('estado', 'en_curso')

  return NextResponse.json({ ok: true })
}
