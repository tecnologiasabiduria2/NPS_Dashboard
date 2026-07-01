import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Foro/Conversación (Bloque 5f). Todas las escrituras pasan por acá con service
// role tras validar sesión; las tablas tienen RLS sin policies (el cliente no
// las toca directo). action = post | comment | like.
async function activeProductId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('user_access').select('product_id')
    .eq('user_id', userId).eq('status', 'active').limit(1).maybeSingle()
  return (data as { product_id?: string } | null)?.product_id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const action = body?.action

  if (action === 'post') {
    const text = String(body?.body ?? '').trim()
    const category = String(body?.category ?? 'general')
    if (!text) return NextResponse.json({ error: 'Escribe algo' }, { status: 400 })
    const pid = await activeProductId(user.id)
    if (!pid) return NextResponse.json({ error: 'Sin acceso activo' }, { status: 403 })
    const { error } = await supabaseAdmin.from('foro_posts').insert({ user_id: user.id, product_id: pid, category, body: text })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'comment') {
    const text = String(body?.body ?? '').trim()
    const post_id = body?.post_id
    if (!text || !post_id) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const { error } = await supabaseAdmin.from('foro_comments').insert({ post_id, user_id: user.id, body: text })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'like') {
    const post_id = body?.post_id
    if (!post_id) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const { data: existing } = await supabaseAdmin
      .from('foro_likes').select('post_id').eq('post_id', post_id).eq('user_id', user.id).maybeSingle()
    if (existing) {
      await supabaseAdmin.from('foro_likes').delete().eq('post_id', post_id).eq('user_id', user.id)
      return NextResponse.json({ ok: true, liked: false })
    }
    await supabaseAdmin.from('foro_likes').insert({ post_id, user_id: user.id })
    return NextResponse.json({ ok: true, liked: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
