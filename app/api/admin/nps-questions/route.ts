import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const TRIGGERS = ['post_sesion', 'semanal'] as const

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const trigger = body?.trigger
  const eyebrow = typeof body?.eyebrow === 'string' ? body.eyebrow.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const question = typeof body?.question === 'string' ? body.question.trim() : ''

  if (!TRIGGERS.includes(trigger)) {
    return NextResponse.json({ error: 'Disparador inválido' }, { status: 400 })
  }
  if (!eyebrow || !title || !question) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('nps_questions').upsert({
    trigger,
    eyebrow,
    title,
    question,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
