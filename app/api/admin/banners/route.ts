import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Banners de anuncios (2026-07-09): admin+owner (contenido, no roster sensible
// como mentores). multipart/form-data porque además de texto sube una imagen
// (mismo patrón que /api/profile/onboarding). Upsert por presencia de `id`.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const id = String(form.get('id') ?? '').trim() || undefined
  const titulo = String(form.get('titulo') ?? '').trim()
  const linkUrlRaw = String(form.get('link_url') ?? '').trim()
  const link_url = linkUrlRaw || null
  const is_active = String(form.get('is_active') ?? 'true') !== 'false'
  const startsAtRaw = String(form.get('starts_at') ?? '').trim()
  const endsAtRaw = String(form.get('ends_at') ?? '').trim()
  const starts_at = startsAtRaw || null
  const ends_at = endsAtRaw || null
  const file = form.get('image')

  if (!titulo) {
    return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
  }
  if (starts_at && ends_at && ends_at <= starts_at) {
    return NextResponse.json({ error: 'La fecha de fin debe ser posterior a la de inicio' }, { status: 400 })
  }

  const update: Record<string, unknown> = { titulo, link_url, is_active, starts_at, ends_at, updated_at: new Date().toISOString() }

  if (file && file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen supera 5MB' }, { status: 400 })
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabaseAdmin.storage
      .from('banners')
      .upload(path, buf, { contentType: file.type || 'image/jpeg' })
    if (upErr) {
      return NextResponse.json({ error: 'No se pudo subir la imagen: ' + upErr.message }, { status: 400 })
    }
    update.image_path = path
  } else if (!id) {
    return NextResponse.json({ error: 'La imagen es obligatoria para un banner nuevo' }, { status: 400 })
  }

  if (id) {
    const { error } = await supabaseAdmin.from('banners').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, updated: true })
  }

  const { data, error } = await supabaseAdmin.from('banners').insert(update).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, created: true, id: data?.id })
}

// Borrado real (a diferencia de mentores): nada depende de un banner por FK,
// así que además del toggle activo/inactivo, se puede eliminar de verdad.
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const id: string | undefined = body?.id
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const { data: banner } = await supabaseAdmin.from('banners').select('image_path').eq('id', id).single()
  const { error } = await supabaseAdmin.from('banners').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (banner?.image_path) {
    await supabaseAdmin.storage.from('banners').remove([banner.image_path])
  }
  return NextResponse.json({ ok: true })
}
