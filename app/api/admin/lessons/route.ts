import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CONTENT_TIPO_VALUES } from '@/lib/sessionTypes'

const VALID_FILE_TYPES = ['video', 'document'] as const

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const id: string | undefined = body?.id || undefined
  const tipo: string = body?.tipo
  const hiperfoco_id: string = body?.hiperfoco_id
  const title: string = (body?.title ?? '').trim()
  const type: string = body?.type
  const fathom_share_id: string | null = (body?.fathom_share_id ?? '').trim() || null
  const storage_path: string | null = (body?.storage_path ?? '').trim() || null
  const is_published = !!body?.is_published
  const orderRaw = body?.order

  if (!hiperfoco_id || !tipo || !title || !type) {
    return NextResponse.json({ error: 'Hiperfoco, tipo, título y tipo de archivo son obligatorios' }, { status: 400 })
  }
  if (!CONTENT_TIPO_VALUES.includes(tipo as any)) {
    return NextResponse.json({ error: 'Tipo de contenido inválido' }, { status: 400 })
  }
  if (!VALID_FILE_TYPES.includes(type as any)) {
    return NextResponse.json({ error: 'Tipo de archivo inválido (video o document)' }, { status: 400 })
  }

  // Validación de video contra Worker
  if (type === 'video') {
    if (!fathom_share_id) {
      return NextResponse.json({ error: 'Los videos requieren un fathom_share_id' }, { status: 400 })
    }
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
    if (!workerUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_WORKER_URL no está configurada' }, { status: 500 })
    }
    const encoded = encodeURIComponent(fathom_share_id)
    let playerOk = false
    let shareOk = false
    try {
      const [playerRes, shareRes] = await Promise.all([
        fetch(`${workerUrl}/player?id=${encoded}`, { cache: 'no-store' }),
        fetch(`${workerUrl}/share/${encoded}/video.m3u8`, { cache: 'no-store' }),
      ])
      playerOk = playerRes.ok
      shareOk = shareRes.ok
    } catch {
      playerOk = false; shareOk = false
    }
    if (!playerOk || !shareOk) {
      return NextResponse.json({
        error: `El fathom_share_id «${fathom_share_id}» no es válido o el Worker no responde.`,
      }, { status: 400 })
    }
  }

  const payload: Record<string, any> = {
    hiperfoco_id,
    tipo,
    title,
    type,
    fathom_share_id: type === 'video' ? fathom_share_id : null,
    storage_path: type === 'document' ? storage_path : null,
    is_published,
  }

  if (orderRaw !== undefined && orderRaw !== null && `${orderRaw}` !== '') {
    payload.order = Number(orderRaw)
  } else if (!id) {
    const { data: last } = await supabaseAdmin
      .from('recordings')
      .select('order')
      .eq('hiperfoco_id', hiperfoco_id)
      .eq('tipo', tipo)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle()
    payload.order = ((last?.order as number) ?? -1) + 1
  }

  if (id) {
    const { error } = await supabaseAdmin.from('recordings').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, updated: true })
  }

  const { data, error } = await supabaseAdmin.from('recordings').insert(payload).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, created: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { error } = await supabaseAdmin.from('recordings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
