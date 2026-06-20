import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ghl-secret')
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { email, full_name, product_access, access_until, ghl_contact_id } = body

  if (!email || !product_access) {
    return NextResponse.json({ error: 'Missing email or product_access' }, { status: 400 })
  }

  // Buscar producto
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('slug', product_access)
    .single()

  if (!product) {
    return NextResponse.json({ error: `Product '${product_access}' not found` }, { status: 400 })
  }

  // ¿Usuario existe ya?
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const existing = users.find(u => u.email === email)

  if (!existing) {
    // Crear usuario + mandar invitación
    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? '' },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vip.sabiduriaempresarial.com'}/activate`,
    })

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    // Crear perfil
    await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      full_name: full_name ?? '',
      role: 'client',
    })

    // Crear acceso
    await supabaseAdmin.from('user_access').insert({
      user_id: newUser.user.id,
      product_id: product.id,
      status: 'active',
      access_until: access_until ?? null,
      ghl_contact_id: ghl_contact_id ?? null,
      platform_invite_sent: true,
      access_started: new Date().toISOString().split('T')[0],
    })
  } else {
    // Reactivar acceso existente
    await supabaseAdmin.from('user_access')
      .update({
        status: 'active',
        access_until: access_until ?? null,
        ghl_contact_id: ghl_contact_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', existing.id)
      .eq('product_id', product.id)
  }

  return NextResponse.json({ ok: true })
}
