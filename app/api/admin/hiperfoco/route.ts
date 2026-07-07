import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveCsIdForHiperfoco } from '@/lib/mentorLookup'

// Primer día del mes actual en hora local (coincide con user_hiperfoco_mes.periodo).
function currentPeriodo() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// POST /api/admin/hiperfoco — la CS asigna el hiperfoco del mes o marca pausa.
// action 'set'   → estado='en_curso' con hiperfoco_id
// action 'pausa' → estado='pausa' con hiperfoco_id NULL
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const user_id: string | undefined = body?.user_id
  const product_id: string | undefined = body?.product_id
  const action: string | undefined = body?.action
  const hiperfoco_id: string | null = body?.hiperfoco_id || null
  const periodo: string = body?.periodo || currentPeriodo()

  if (!user_id || !product_id || !action) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // cs_id = el mentor ya asignado a este hiperfoco+mes (dicta el grupo Y hace
  // las 1:1), o quien hace la asignación si todavía no hay mentor definido.
  const cs_id = await resolveCsIdForHiperfoco(hiperfoco_id, periodo, user.id)

  const base = {
    user_id,
    product_id,
    periodo,
    cs_id,
    assigned_by: user.id,
    updated_at: new Date().toISOString(),
  }

  let payload
  if (action === 'set') {
    if (!hiperfoco_id) return NextResponse.json({ error: 'Selecciona un hiperfoco' }, { status: 400 })
    payload = { ...base, hiperfoco_id, estado: 'en_curso' }
  } else if (action === 'pausa') {
    payload = { ...base, hiperfoco_id: null, estado: 'pausa' }
  } else {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_hiperfoco_mes')
    .upsert(payload, { onConflict: 'user_id,product_id,periodo' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
