import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Verificar que es admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, phone, product_access, access_until, ghl_contact_id } = await req.json()

  if (!email || !product_access || !access_until) {
    return NextResponse.json({ error: 'Email, programa y fecha de acceso son obligatorios' }, { status: 400 })
  }

  // Buscar producto
  const { data: product } = await supabaseAdmin
    .from('products').select('id').eq('slug', product_access).single()

  if (!product) {
    return NextResponse.json({ error: `Programa '${product_access}' no encontrado` }, { status: 400 })
  }

  // ¿Ya existe?
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const existing = users.find(u => u.email === email)

  if (existing) {
    // Reactivar o crear acceso al producto
    const { data: existingAccess } = await supabaseAdmin
      .from('user_access').select('id').eq('user_id', existing.id).eq('product_id', product.id).single()

    if (existingAccess) {
      await supabaseAdmin.from('user_access')
        .update({ status: 'active', access_until, ghl_contact_id: ghl_contact_id || null, updated_at: new Date().toISOString() })
        .eq('user_id', existing.id).eq('product_id', product.id)
    } else {
      await supabaseAdmin.from('user_access').insert({
        user_id: existing.id, product_id: product.id, status: 'active',
        access_until, ghl_contact_id: ghl_contact_id || null,
        platform_invite_sent: true, access_started: new Date().toISOString().split('T')[0],
      })
    }
    return NextResponse.json({ ok: true, existing: true })
  }

  // Crear usuario nuevo
  const { data: newUser, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name ?? '' },
    redirectTo: 'https://vip.sabiduriaempresarial.com/activate',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Crear perfil
  await supabaseAdmin.from('profiles').upsert({
    id: newUser.user.id,
    full_name: full_name ?? '',
    phone: phone || null,
    role: 'client',
  })

  // Crear acceso
  await supabaseAdmin.from('user_access').insert({
    user_id: newUser.user.id, product_id: product.id, status: 'active',
    access_until, ghl_contact_id: ghl_contact_id || null,
    platform_invite_sent: true, access_started: new Date().toISOString().split('T')[0],
  })

  return NextResponse.json({ ok: true, created: true })
}
