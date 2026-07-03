import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { timingSafeEqualStr } from '@/lib/timingSafeEqual'

export async function POST(req: NextRequest) {
  const expected = process.env.GHL_WEBHOOK_SECRET
  const secret = req.headers.get('x-ghl-secret') ?? ''
  if (!expected || !timingSafeEqualStr(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ghl_contact_id, email } = await req.json()

  if (ghl_contact_id) {
    await supabaseAdmin
      .from('user_access')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('ghl_contact_id', ghl_contact_id)
  } else if (email) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const user = users.find(u => u.email === email)
    if (user) {
      await supabaseAdmin
        .from('user_access')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({ ok: true })
}
