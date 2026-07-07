import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Crear un Business Coach (calibración 2026-07-07 noche: escalar a 2+). Invita
// una cuenta real (role='admin', loguea y hace 1:1) + foto opcional — mismo
// patrón de subida que /api/profile/onboarding (bucket público 'avatars').
export async function POST(req: NextRequest) {
  const auth = await requireOwner()
  if ('error' in auth) return auth.error

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const email = String(form.get('email') ?? '').trim()
  const full_name = String(form.get('full_name') ?? '').trim()
  const file = form.get('avatar')

  if (!email || !full_name) {
    return NextResponse.json({ error: 'Correo y nombre son obligatorios' }, { status: 400 })
  }

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: 'https://vip.sabiduriaempresarial.com/activate',
  })
  if (inviteError) {
    return NextResponse.json({ error: inviteError.message ?? 'No se pudo invitar' }, { status: 400 })
  }
  const userId = invited.user.id

  let avatar_url: string | null = null
  if (file && file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${userId}/avatar.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })
    if (!upErr) {
      const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
      avatar_url = `${pub.publicUrl}?v=${Date.now()}`
    }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, full_name, role: 'admin', avatar_url })
  if (profileError) {
    return NextResponse.json({ error: 'Perfil no se pudo crear: ' + profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, user_id: userId })
}
