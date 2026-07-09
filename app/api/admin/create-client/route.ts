import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidPhoneWithPrefix } from '@/lib/phone'
import { sendProductAddedEmail } from '@/lib/productAddedEmail'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const { email, full_name, phone, product_access, access_until, ghl_contact_id } = await req.json()

    if (!email || !product_access || !access_until) {
      return NextResponse.json({ error: 'Email, programa y fecha de acceso son obligatorios' }, { status: 400 })
    }

    const ghlContactId = typeof ghl_contact_id === 'string' ? ghl_contact_id.trim() : ''
    if (!ghlContactId) {
      return NextResponse.json({ error: 'El ID de contacto en GHL es obligatorio.' }, { status: 400 })
    }

    if (!isValidPhoneWithPrefix(phone)) {
      return NextResponse.json({ error: 'El teléfono debe incluir el indicativo, ej: +57 300 1234567' }, { status: 400 })
    }

    const { data: product } = await supabaseAdmin
      .from('products').select('id, title').eq('slug', product_access).single()

    if (!product) {
      return NextResponse.json({ error: `Programa '${product_access}' no encontrado` }, { status: 400 })
    }

    // Sin perPage, listUsers() trae solo 50 usuarios (default de GoTrue) — con
    // más de 50 cuentas, un cliente existente podía no detectarse y crearse
    // duplicado (bug encontrado 2026-07-09).
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (listError) {
      console.error('[create-client] listUsers failed:', listError)
      return NextResponse.json({ error: 'Error al consultar usuarios existentes.' }, { status: 500 })
    }

    // Comparación sin distinguir mayúsculas/minúsculas — mismo bug que en
    // ghl-webhook (2026-07-09): un email con distinta capitalización no
    // detectaba la cuenta existente y creaba una duplicada.
    const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (existing) {
      if (phone) {
        await supabaseAdmin.from('profiles').update({ phone }).eq('id', existing.id)
      }

      const { data: existingAccess } = await supabaseAdmin
        .from('user_access').select('id').eq('user_id', existing.id).eq('product_id', product.id).single()

      if (existingAccess) {
        await supabaseAdmin.from('user_access')
          .update({ status: 'active', access_until, ghl_contact_id: ghlContactId, updated_at: new Date().toISOString() })
          .eq('user_id', existing.id).eq('product_id', product.id)
      } else {
        await supabaseAdmin.from('user_access').insert({
          user_id: existing.id, product_id: product.id, status: 'active',
          access_until, ghl_contact_id: ghlContactId,
          platform_invite_sent: true, access_started: new Date().toISOString().split('T')[0],
        })
        // Producto realmente nuevo para un cliente ya registrado (no una
        // renovación del mismo producto) — mismo aviso que ya manda el flujo
        // de GHL en este caso (ghl-webhook: sendProductAddedEmail).
        await sendProductAddedEmail(email, full_name ?? '', product.title)
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
      access_until, ghl_contact_id: ghlContactId,
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
