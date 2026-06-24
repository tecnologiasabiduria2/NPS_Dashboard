import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/flags — gestiona banderas y casos de éxito (client_flags).
// action 'raise'   → abre una bandera o caso de éxito
// action 'resolve' → cierra (status='resuelta') una existente por id
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const action: string | undefined = body?.action

  if (action === 'raise') {
    const user_id: string | undefined = body?.user_id
    const type: string | undefined = body?.type
    const reason: string | null = body?.reason?.trim() || null
    const product_id: string | null = body?.product_id || null

    if (!user_id || (type !== 'bandera' && type !== 'caso_exito')) {
      return NextResponse.json({ error: 'Datos de bandera inválidos' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('client_flags').insert({
      user_id,
      product_id,
      type,
      reason,
      created_by: user.id,
      status: 'abierta',
    })

    if (error) {
      // unique parcial: solo puede haber un caso de éxito activo por cliente.
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya hay un caso de éxito activo para este cliente.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'resolve') {
    const flag_id: string | undefined = body?.flag_id
    if (!flag_id) return NextResponse.json({ error: 'Falta el id de la bandera' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('client_flags')
      .update({
        status: 'resuelta',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', flag_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
