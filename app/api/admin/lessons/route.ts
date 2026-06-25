import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const VALID_TYPES = ['video', 'document'] as const

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  // --- Entrada ---
  const body = await req.json().catch(() => null)
  const id: string | undefined = body?.id || undefined
  const module_id: string = body?.module_id
  const title: string = (body?.title ?? '').trim()
  const type: string = body?.type
  const fathom_share_id: string | null = (body?.fathom_share_id ?? '').trim() || null
  const storage_path: string | null = (body?.storage_path ?? '').trim() || null
  const is_published = !!body?.is_published
  const orderRaw = body?.order

  if (!module_id || !title || !type) {
    return NextResponse.json({ error: 'Módulo, título y tipo son obligatorios' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type as any)) {
    return NextResponse.json({ error: 'Tipo de lección inválido' }, { status: 400 })
  }

  // El módulo debe existir
  const { data: mod } = await supabaseAdmin.from('modules').select('id').eq('id', module_id).single()
  if (!mod) return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 400 })

  // --- Validación del contenido de video contra el Worker ---
  if (type === 'video') {
    if (!fathom_share_id) {
      return NextResponse.json({ error: 'Los videos requieren un fathom_share_id' }, { status: 400 })
    }
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
    if (!workerUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_WORKER_URL no está configurada en el servidor' }, { status: 500 })
    }
    const encoded = encodeURIComponent(fathom_share_id)

    // Se valida contra DOS rutas del Worker, a propósito (verificado empíricamente 2026-06-23):
    //  1) /player?id=<id>        → contrato PÚBLICO/ESTABLE del embed (el mismo <iframe> que usa
    //     GHL en producción). Confirma que el Worker está arriba. OJO: devuelve 200 para CUALQUIER
    //     id (real, inventado o vacío), así que por sí sola NO distingue un id válido de uno falso.
    //  2) /share/<id>/video.m3u8 → ruta INTERNA que SÍ discrimina: 200 si el id existe de verdad,
    //     404 si es inventado/typo. Es la que realmente atrapa ids inválidos.
    // Por eso se exigen AMBAS (si cualquiera falla, se rechaza el guardado). Si algún día /share
    // cambia o desaparece, ESTE es el punto a ajustar — no /player, que es el contrato estable.
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
      playerOk = false
      shareOk = false
    }
    if (!playerOk || !shareOk) {
      return NextResponse.json({
        error: `El fathom_share_id «${fathom_share_id}» no es válido o el Worker no responde. Verifícalo en GHL.`,
      }, { status: 400 })
    }
  }

  // --- Payload: solo el campo identificador correspondiente al tipo ---
  const payload: Record<string, any> = {
    module_id,
    title,
    type,
    fathom_share_id: type === 'video' ? fathom_share_id : null,
    storage_path: type === 'document' ? storage_path : null,
    is_published,
  }

  // order: si viene se respeta; si es lección nueva sin order, va al final del módulo
  if (orderRaw !== undefined && orderRaw !== null && `${orderRaw}` !== '') {
    payload.order = Number(orderRaw)
  } else if (!id) {
    const { data: last } = await supabaseAdmin
      .from('lessons')
      .select('order')
      .eq('module_id', module_id)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle()
    payload.order = ((last?.order as number) ?? -1) + 1
  }

  // --- Insert o update ---
  if (id) {
    const { error } = await supabaseAdmin.from('lessons').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, updated: true })
  }

  const { data, error } = await supabaseAdmin.from('lessons').insert(payload).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, created: true, id: data.id })
}
