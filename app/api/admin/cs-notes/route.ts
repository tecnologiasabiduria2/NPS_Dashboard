import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/cs-notes — agrega una nota INTERNA del CS (cs_internal_notes).
// Tabla separada de coaching_notes, sin lectura para el cliente (ver migración).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const user_id: string | undefined = body?.user_id
  const content: string | undefined = body?.content
  const note_date: string | undefined = body?.note_date
  const product_id: string | null = body?.product_id || null

  if (!user_id || !content?.trim() || !note_date) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('cs_internal_notes').insert({
    user_id,
    author_id: user.id,
    content: content.trim(),
    note_date,
    product_id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
