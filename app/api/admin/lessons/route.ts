import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CONTENT_TIPO_VALUES } from '@/lib/sessionTypes'

const VALID_FILE_TYPES = ['video', 'document'] as const
const MAX_DOC_BYTES = 50 * 1024 * 1024 // 50MB

// Whitelist server-side (no confiar solo en el `accept` del <input>, que el
// navegador ignora si alguien manda la petición directo). Extensión y
// content-type real que se guarda en Storage van de la mano con esta lista,
// para que nunca se sirva un archivo con un tipo que pueda ejecutarse en el
// navegador (html/svg/js) haciéndose pasar por un documento del curso.
const ALLOWED_DOC_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'documento'
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const id = String(form.get('id') ?? '').trim() || undefined
  const tipo = String(form.get('tipo') ?? '')
  const hiperfoco_id = String(form.get('hiperfoco_id') ?? '')
  const title = String(form.get('title') ?? '').trim()
  const type = String(form.get('type') ?? '')
  const fathom_share_id: string | null = String(form.get('fathom_share_id') ?? '').trim() || null
  const existingStoragePath: string | null = String(form.get('existing_storage_path') ?? '').trim() || null
  const is_published = form.get('is_published') === 'true'
  const orderRaw = form.get('order')
  const file = form.get('file')

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

  // Documento: sube el archivo real al bucket privado `content` (mismo patrón que
  // el avatar de onboarding). Si no llega un archivo nuevo, conserva la ruta
  // existente (edición sin reemplazar el PDF).
  let storage_path: string | null = existingStoragePath
  if (type === 'document') {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_DOC_BYTES) {
        return NextResponse.json({ error: 'El archivo supera el máximo de 50MB' }, { status: 400 })
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const safeContentType = ALLOWED_DOC_TYPES[ext]
      if (!safeContentType) {
        return NextResponse.json({ error: 'Tipo de archivo no permitido. Usa PDF, Word, PowerPoint o Excel.' }, { status: 400 })
      }
      const path = `${hiperfoco_id}/${tipo}/${Date.now()}-${slugify(title)}.${ext}`
      const buf = Buffer.from(await file.arrayBuffer())
      const { error: upErr } = await supabaseAdmin.storage
        .from('content')
        .upload(path, buf, { contentType: safeContentType, upsert: true })
      if (upErr) {
        return NextResponse.json({ error: 'No se pudo subir el archivo: ' + upErr.message }, { status: 400 })
      }
      storage_path = path
    }
    if (!storage_path) {
      return NextResponse.json({ error: 'Sube un archivo para el documento' }, { status: 400 })
    }
  } else {
    storage_path = null
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
