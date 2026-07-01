import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SESSION_TIPO_VALUES } from '@/lib/sessionTypes'

// POST /api/admin/sessions — crea o actualiza una sesión en vivo
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const id: string | undefined = body?.id || undefined
  const product_id: string = body?.product_id
  const title: string = (body?.title ?? '').trim() || 'Sesión en vivo'
  const tipo: string = body?.tipo
  const zoom_url: string = (body?.zoom_url ?? '').trim()
  const starts_at: string = body?.starts_at
  const ends_at: string = body?.ends_at
  const is_published = !!body?.is_published
  const descripcion: string = (body?.descripcion ?? '').trim()

  if (!product_id || !starts_at || !ends_at || !zoom_url) {
    return NextResponse.json({ error: 'Producto, inicio, fin y link de Zoom son obligatorios' }, { status: 400 })
  }
  if (!SESSION_TIPO_VALUES.includes(tipo as any)) {
    return NextResponse.json({ error: 'Tipo de sesión inválido' }, { status: 400 })
  }
  if (new Date(ends_at).getTime() <= new Date(starts_at).getTime()) {
    return NextResponse.json({ error: 'La hora de fin debe ser posterior a la de inicio' }, { status: 400 })
  }

  // El producto debe existir
  const { data: product } = await supabaseAdmin.from('products').select('id').eq('id', product_id).single()
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })

  const payload: Record<string, any> = { product_id, title, tipo, zoom_url, starts_at, ends_at, is_published, descripcion: descripcion || null, updated_at: new Date().toISOString() }
  // Si la columna descripcion aún no existe (migración pendiente), reintenta sin ella.
  const stripDesc = (p: Record<string, any>) => { const { descripcion: _d, ...rest } = p; return rest }

  if (id) {
    let { error } = await supabaseAdmin.from('live_sessions').update(payload).eq('id', id)
    if (error?.code === '42703') ({ error } = await supabaseAdmin.from('live_sessions').update(stripDesc(payload)).eq('id', id))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, updated: true })
  }

  let { data, error } = await supabaseAdmin.from('live_sessions').insert(payload).select('id').single()
  if (error?.code === '42703') ({ data, error } = await supabaseAdmin.from('live_sessions').insert(stripDesc(payload)).select('id').single())
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, created: true, id: data?.id })
}

// DELETE /api/admin/sessions?id=<uuid> — elimina una sesión
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('live_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, deleted: true })
}
