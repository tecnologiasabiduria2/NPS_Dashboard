import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { updateContactFields } from '@/lib/ghl/api'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, access_until, ghl_contact_id } = await req.json()
  if (!user_id || !access_until) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Actualizar Supabase
  await supabaseAdmin
    .from('user_access')
    .update({ access_until, updated_at: new Date().toISOString() })
    .eq('user_id', user_id)

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
