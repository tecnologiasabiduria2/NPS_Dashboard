import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await req.json().catch(() => null)
    const id: string | undefined = body?.id || undefined
    const product_id: string | undefined = body?.product_id
    const title: string = (body?.title ?? '').trim()
    const hiperfoco_id: string | null = body?.hiperfoco_id || null
    const is_published = !!body?.is_published
    const orderRaw = body?.order

    if (!title) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

    if (id) {
      const payload: Record<string, any> = { title, hiperfoco_id, is_published }
      if (orderRaw !== undefined && orderRaw !== null && `${orderRaw}` !== '') {
        payload.order = Number(orderRaw)
      }
      const { error } = await supabaseAdmin.from('modules').update(payload).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, updated: true })
    }

    if (!product_id) {
      return NextResponse.json({ error: 'El producto es obligatorio para crear un módulo' }, { status: 400 })
    }

    const { data: last } = await supabaseAdmin
      .from('modules')
      .select('order')
      .eq('product_id', product_id)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const order = (orderRaw !== undefined && orderRaw !== null && `${orderRaw}` !== '')
      ? Number(orderRaw)
      : ((last?.order as number) ?? 0) + 1

    const { data, error } = await supabaseAdmin.from('modules').insert({
      product_id,
      title,
      hiperfoco_id,
      order,
      is_published,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, created: true, id: data.id })
  } catch (err) {
    console.error('[modules] Unhandled error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message || 'Error interno del servidor.' }, { status: 500 })
  }
}
