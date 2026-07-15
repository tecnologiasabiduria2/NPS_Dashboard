import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidPhoneWithPrefix } from '@/lib/phone'

// Onboarding del miembro (Bloque 5e) Y edición de perfil desde /profile
// (2026-07-09, antes era de solo lectura): mismo endpoint para las dos
// pantallas — guarda nombre/bio/redes/teléfono y, opcional, la foto de
// perfil (subida real al bucket público 'avatars' con service role).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const fullName = String(form.get('full_name') ?? '').trim()
  const bio = String(form.get('bio') ?? '').trim()
  const instagram = String(form.get('instagram') ?? '').trim()
  const website = String(form.get('website') ?? '').trim()
  const sector = String(form.get('sector') ?? '').trim()
  const productoServicio = String(form.get('producto_servicio') ?? '').trim()
  const phone = String(form.get('phone') ?? '').trim()
  const file = form.get('avatar')

  if (!isValidPhoneWithPrefix(phone)) {
    return NextResponse.json({ error: 'El teléfono debe incluir el indicativo, ej: +57 300 1234567' }, { status: 400 })
  }

  // full_name sí puede "vaciarse" a propósito desde /profile si el campo llega
  // en el form (a diferencia de bio/instagram/website, que en el onboarding
  // original nunca se mandan vacíos porque el campo ni existe ahí).
  const update: Record<string, string> = {}
  if (form.has('full_name')) update.full_name = fullName
  if (bio) update.bio = bio
  if (instagram) update.instagram = instagram
  if (website) update.website = website
  if (sector) update.sector = sector
  if (productoServicio) update.producto_servicio = productoServicio
  if (phone) update.phone = phone

  if (file && file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen supera 5MB' }, { status: 400 })
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })
    if (upErr) {
      return NextResponse.json({ error: 'No se pudo subir la imagen: ' + upErr.message }, { status: 400 })
    }
    const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
    // ?v= para bustear caché del navegador al reemplazar la misma ruta.
    update.avatar_url = `${pub.publicUrl}?v=${Date.now()}`
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay nada que guardar' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('profiles').update(update).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
