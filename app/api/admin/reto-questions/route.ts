import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const IDS = ['claridad', 'confianza', 'reto'] as const

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const id = body?.id
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : ''

  if (!IDS.includes(id)) {
    return NextResponse.json({ error: 'Pregunta inválida' }, { status: 400 })
  }
  if (!texto) {
    return NextResponse.json({ error: 'El texto es obligatorio.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('reto_preguntas').upsert({
    id,
    texto,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
