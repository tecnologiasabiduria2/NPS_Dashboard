import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { email, full_name, phone, product_access, access_until, ghl_contact_id } = await req.json()

    if (!email || !product_access || !access_until) {
      return NextResponse.json({ error: 'Email, programa y fecha de acceso son obligatorios' }, { status: 400 })
    }

    const { data: product } = await supabaseAdmin
      .from('products').select('id').eq('slug', product_access).single()

    if (!product) {
      return NextResponse.json({ error: `Programa '${product_access}' no encontrado` }, { status: 400 })
    }

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('[create-client] listUsers failed:', listError)
      return NextResponse.json({ error: 'Error al consultar usuarios existentes.' }, { status: 500 })
    }

    const existing = users.find(u => u.email === email)

    if (existing) {
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

    const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? '' },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vip.sabiduriaempresarial.com'}/activate`,
    })

    if (inviteError) {
      console.error('[create-client] inviteUserByEmail failed:', inviteError)
      const rawMsg = inviteError.message
      const isUseless = !rawMsg || rawMsg === '{}' || rawMsg === '{}'
      return NextResponse.json({
        error: isUseless
          ? 'Error al enviar la invitación. Supabase no pudo enviar el email — verifica la configuración SMTP y el dominio del remitente en Resend.'
          : rawMsg,
      }, { status: 500 })
    }

    await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      full_name: full_name ?? '',
      phone: phone || null,
      role: 'client',
    })

    await supabaseAdmin.from('user_access').insert({
      user_id: newUser.user.id, product_id: product.id, status: 'active',
      access_until, ghl_contact_id: ghl_contact_id || null,
      platform_invite_sent: true, access_started: new Date().toISOString().split('T')[0],
    })

    return NextResponse.json({ ok: true, created: true })
  } catch (err) {
    console.error('[create-client] Unhandled error:', err)
    const raw = err instanceof Error ? err.message : String(err)
    const message = (!raw || raw === '{}') ? 'Error interno del servidor.' : raw
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
