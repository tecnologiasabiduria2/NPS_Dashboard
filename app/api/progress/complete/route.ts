import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recording_id, completed } = await req.json()
  if (!recording_id) return NextResponse.json({ error: 'Missing recording_id' }, { status: 400 })

  await supabaseAdmin.from('recording_progress').upsert({
    user_id: user.id,
    recording_id,
    completed: completed ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,recording_id' })

  return NextResponse.json({ ok: true })
}
