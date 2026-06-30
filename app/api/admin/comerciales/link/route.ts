import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Vincula (o desvincula) un usuario de GHL con un profile local (CS).
// Solo el owner (Diana). Relación 1:1: un usuario GHL ↔ a lo sumo un profile.
export async function POST(req: NextRequest) {
  const auth = await requireOwner()
  if ('error' in auth) return auth.error

  const { ghl_user_id, profile_id } = await req.json()
  if (!ghl_user_id || typeof ghl_user_id !== 'string') {
    return NextResponse.json({ error: 'Falta ghl_user_id' }, { status: 400 })
  }

  // 1. Liberar este usuario de GHL de cualquier profile que lo tuviera.
  const { error: clearErr } = await supabaseAdmin
    .from('profiles')
    .update({ ghl_user_id: null })
    .eq('ghl_user_id', ghl_user_id)
  if (clearErr) {
    return NextResponse.json({ error: clearErr.message }, { status: 500 })
  }

  // 2. Si se indicó un profile, vincularlo (sobrescribe su mapeo anterior si tenía).
  if (profile_id && typeof profile_id === 'string') {
    const { error: setErr } = await supabaseAdmin
      .from('profiles')
      .update({ ghl_user_id })
      .eq('id', profile_id)
    if (setErr) {
      return NextResponse.json({ error: setErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
