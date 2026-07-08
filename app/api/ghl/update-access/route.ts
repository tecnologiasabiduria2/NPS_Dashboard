import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { updateContactFields } from '@/lib/ghl/api'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { user_id, product_id, access_until, ghl_contact_id } = await req.json()
  if (!user_id || !product_id || !access_until) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Actualizar Supabase — filtrado también por product_id: un cliente con 2+
  // productos en su historial (uno terminado, uno vigente) tiene 2+ filas en
  // user_access; sin este filtro, editar la fecha de uno pisaba la de todos
  // (bug encontrado 2026-07-09).
  const { error: updateError } = await supabaseAdmin
    .from('user_access')
    .update({ access_until, updated_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .eq('product_id', product_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Actualizar GHL si tiene contact ID
  if (ghl_contact_id && process.env.GHL_API_KEY) {
    try {
      await updateContactFields(ghl_contact_id, { access_until })
    } catch (e) {
      console.error('GHL sync failed:', e)
      // No falla el request si GHL falla
    }
  }

  return NextResponse.json({ ok: true })
}
