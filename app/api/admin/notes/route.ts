import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // requireAdmin permite admin (CS) y owner (Diana).
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { user_id, content, session_date, fathom_share_id } = await req.json()
  if (!user_id || !content?.trim() || !session_date) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const fathomId = typeof fathom_share_id === 'string' ? fathom_share_id.trim() : ''

  const { error } = await supabaseAdmin.from('coaching_notes').insert({
    user_id,
    admin_id: auth.user.id,
    content: content.trim(),
    session_date,
    fathom_share_id: fathomId || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
