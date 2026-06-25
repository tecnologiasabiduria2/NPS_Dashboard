import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { updateContactFields } from '@/lib/ghl/api'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { user_id, access_until, ghl_contact_id } = await req.json()
  if (!user_id || !access_until) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Actualizar Supabase
  const { error: updateError } = await supabaseAdmin
    .from('user_access')
    .update({ access_until, updated_at: new Date().toISOString() })
    .eq('user_id', user_id)

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
