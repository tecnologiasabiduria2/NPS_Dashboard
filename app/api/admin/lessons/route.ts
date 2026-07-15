import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CONTENT_TIPO_VALUES } from '@/lib/sessionTypes'
import { notifyUsers, getRecordingRecipients } from '@/lib/notifications'

const VALID_FILE_TYPES = ['video', 'document'] as const

// Notificación in-app (2026-07-15, Fase 6): se dispara solo en la transición
// borrador → publicado, nunca en cada guardado de una grabación ya publicada.
// Envuelto en try/catch: si notificar falla, no debe tumbar la publicación real.
async function notifyNewRecording(hiperfocoId: string, tipo: string, title: string) {
  try {
    const recipients = await getRecordingRecipients(hiperfocoId, tipo)
    await notifyUsers({ userIds: recipients, type: 'nueva_grabacion', title: 'Nuevo contenido disponible', body: title, link: '/roadmap' })
  } catch {
    // silencioso — no bloquea la publicación
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const id = String(body.id ?? '').trim() || undefined
  const tipo = String(body.tipo ?? '')
  const hiperfoco_id = String(body.hiperfoco_id ?? '')
  const title = String(body.title ?? '').trim()
  const type = String(body.type ?? '')
  const fathom_share_id: string | null = String(body.fathom_share_id ?? '').trim() || null
  const driveUrl: string | null = String(body.drive_url ?? '').trim() || null
  const is_published = Boolean(body.is_published)
  const orderRaw = body.order

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

  // Documento: link de Google Drive (pedido de Diana, calibración 2026-07-06 —
  // todos sus archivos viven en Drive con prompts/hipervínculos conectados, ya
  // no se sube el archivo directo a un bucket).
  let storage_path: string | null = null
  if (type === 'document') {
    if (!driveUrl || !/^https:\/\//.test(driveUrl)) {
      return NextResponse.json({ error: 'Pega un link de Drive válido (debe empezar con https://)' }, { status: 400 })
    }
    storage_path = driveUrl
  }

  const payload: Record<string, any> = {
    hiperfoco_id,
    tipo,
    title,
    type,
    fathom_share_id: type === 'video' ? fathom_share_id : null,
    storage_path,
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
    const { data: existing } = await supabaseAdmin.from('recordings').select('is_published').eq('id', id).maybeSingle()
    const wasPublished = Boolean(existing?.is_published)

    const { error } = await supabaseAdmin.from('recordings').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (is_published && !wasPublished) await notifyNewRecording(hiperfoco_id, tipo, title)
    return NextResponse.json({ ok: true, updated: true })
  }

  const { data, error } = await supabaseAdmin.from('recordings').insert(payload).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (is_published) await notifyNewRecording(hiperfoco_id, tipo, title)
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
