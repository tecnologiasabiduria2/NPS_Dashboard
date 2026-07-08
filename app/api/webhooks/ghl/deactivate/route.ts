import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { timingSafeEqualStr } from '@/lib/timingSafeEqual'

export async function POST(req: NextRequest) {
  const expected = process.env.GHL_WEBHOOK_SECRET
  const secret = req.headers.get('x-ghl-secret') ?? ''
  if (!expected || !timingSafeEqualStr(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ghl_contact_id, email } = await req.json()

  if (ghl_contact_id) {
    await supabaseAdmin
      .from('user_access')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('ghl_contact_id', ghl_contact_id)
  } else if (email) {
    // Sin perPage, listUsers() trae solo 50 usuarios (default de GoTrue) — con
    // más de 50 cuentas de auth, una baja real podía no encontrar al usuario y
    // fallar en silencio (bug encontrado 2026-07-09).
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    // Comparación sin distinguir mayúsculas/minúsculas — mismo bug que en
    // ghl-webhook (2026-07-09): una baja real podía no encontrar la cuenta si
    // GHL mandaba el email con distinta capitalización a la guardada.
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (user) {
      await supabaseAdmin
        .from('user_access')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    } else {
      console.error('ghl/deactivate: no se encontró usuario con email', email)
    }
  }

  return NextResponse.json({ ok: true })
}
