import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lesson_id, completed } = await req.json()
  if (!lesson_id) return NextResponse.json({ error: 'Missing lesson_id' }, { status: 400 })

  await supabaseAdmin.from('lesson_progress').upsert({
    user_id: user.id,
    lesson_id,
    completed: completed ?? true,
    completed_at: completed !== false ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,lesson_id' })

  return NextResponse.json({ ok: true })
}
