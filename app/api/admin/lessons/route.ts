import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const VALID_TYPES = ['video', 'document', 'checklist_item'] as const

// POST /api/admin/lessons
// Crea o actualiza una lección. El admin solo habla con esta ruta;
// el insert/update a Supabase lo hace el backend (service role), nunca SQL manual.
// Para videos, valida el fathom_share_id contra el Worker antes de guardar.
export async function POST(req: NextRequest) {
  // --- Verificación de admin (mismo patrón que /api/admin/create-client) ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
    let valid = false
    try {
      const res = await fetch(`${workerUrl}/share/${encodeURIComponent(fathom_share_id)}/video.m3u8`, { cache: 'no-store' })
      valid = res.ok
    } catch {
      valid = false
    }
    if (!valid) {
      return NextResponse.json({
        error: `El fathom_share_id «${fathom_share_id}» no existe o no responde en el Worker. Verifícalo en GHL.`,
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
