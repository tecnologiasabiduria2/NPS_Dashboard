import { createClient } from 'npm:@supabase/supabase-js@2'

// Compara sin filtrar por timing cuanto coincide (evita side-channel en el secreto).
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// Alias de product_access -> slug real en la BD. "Impulso Empresarial" reutiliza
// el producto `Workshop` (solo se le cambió el título, no el slug, para no romper
// filtros existentes por slug — ver B20 en PENDIENTES.md). El workflow de GHL
// manda "impulso", que no coincide con ningún slug real — se traduce aquí.
const PRODUCT_SLUG_ALIASES: Record<string, string> = {
  impulso: 'workshop',
}

function resolveProductSlug(raw: string): string {
  return PRODUCT_SLUG_ALIASES[raw] ?? raw
}

// Duración fija por producto (confirmado por Juan 2026-07-02): si GHL no manda
// access_until, se calcula hoy + duración del producto. Si el día llega a mandarse
// desde GHL, ese valor siempre tiene prioridad sobre este default.
// 'workshop' (2026-07-07, Impulso Empresarial): 6 meses puesto como default
// PROVISIONAL, sin confirmar todavía con Diana — ver PENDIENTES.md, revisar/
// ajustar cuando se defina el plan real.
const DEFAULT_DURATION_MONTHS: Record<string, number> = {
  desafio: 6,
  sabiduria: 12,
  workshop: 6,
}

function defaultAccessUntil(productSlug: string, fromDate: Date): string | null {
  const months = DEFAULT_DURATION_MONTHS[productSlug]
  if (!months) return null
  const d = new Date(fromDate)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().split('T')[0]
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function findUserByEmail(email: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  )
  const json = await res.json()
  const users: any[] = json.users ?? []
  const found = users.find((u: any) => u.email === email)
  return found?.id ?? null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { email, full_name, product_access, ghl_contact_id, secret } = body
  const productSlug = resolveProductSlug(product_access)
  // Si GHL manda access_until, ese valor SIEMPRE gana. Si no lo manda, se calcula
  // un default por producto — pero la fecha BASE depende de si es alta nueva
  // (hoy) o renovación de un acceso ya existente (ver más abajo: si renueva
  // ANTES de vencer, se extiende desde su access_until vigente, no desde hoy,
  // para no perder el tiempo que le quedaba — corrección 2026-07-08, B18).
  const explicitAccessUntil: string | null =
    body.access_until && body.access_until !== 'null' && body.access_until !== '' ? body.access_until : null

  const expectedSecret = Deno.env.get('GHL_WEBHOOK_SECRET')
  if (!expectedSecret || !timingSafeEqualStr(String(secret ?? ''), expectedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!email || !product_access) {
    return new Response(JSON.stringify({ error: 'Missing email or product_access' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Buscar producto
  const { data: product, error: productError } = await supabase
    .from('products').select('id').eq('slug', productSlug).single()

  if (productError || !product) {
    return new Response(JSON.stringify({ error: `Product '${product_access}' not found` }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // ¿Usuario existe?
  const existingId = await findUserByEmail(email)

  if (!existingId) {
    // Crear usuario + invitación
    const { data: newUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? '' },
      redirectTo: 'https://vip.sabiduriaempresarial.com/activate',
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message ?? 'Invite failed' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = newUser.user.id

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId, full_name: full_name ?? '', role: 'client'
    })
    if (profileError) {
      return new Response(JSON.stringify({ error: 'Profile insert failed: ' + profileError.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const access_until = explicitAccessUntil ?? defaultAccessUntil(productSlug, new Date())

    const { error: accessError } = await supabase.from('user_access').insert({
      user_id: userId,
      product_id: product.id,
      status: 'active',
      access_until: access_until ?? null,
      ghl_contact_id: ghl_contact_id ?? null,
      platform_invite_sent: true,
      access_started: new Date().toISOString().split('T')[0],
    })
    if (accessError) {
      return new Response(JSON.stringify({ error: 'Access insert failed: ' + accessError.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true, action: 'created', user_id: userId }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Usuario existe — actualizar acceso
  const { data: existingAccess } = await supabase
    .from('user_access').select('id, access_until')
    .eq('user_id', existingId).eq('product_id', product.id).single()

  if (existingAccess) {
    // Renovación: si GHL no manda access_until explícito y el acceso actual
    // todavía no venció, se extiende desde esa fecha vigente (no desde hoy) —
    // así una renovación anticipada no le quita al cliente el tiempo que le
    // quedaba (bug corregido 2026-07-08, B18).
    const todayStr = new Date().toISOString().split('T')[0]
    const baseDate = existingAccess.access_until && existingAccess.access_until > todayStr
      ? new Date(`${existingAccess.access_until}T00:00:00Z`)
      : new Date()
    const access_until = explicitAccessUntil ?? defaultAccessUntil(productSlug, baseDate)

    await supabase.from('user_access')
      .update({ status: 'active', access_until: access_until ?? null, updated_at: new Date().toISOString() })
      .eq('user_id', existingId).eq('product_id', product.id)
  } else {
    const access_until = explicitAccessUntil ?? defaultAccessUntil(productSlug, new Date())

    await supabase.from('user_access').insert({
      user_id: existingId,
      product_id: product.id,
      status: 'active',
      access_until: access_until ?? null,
      ghl_contact_id: ghl_contact_id ?? null,
      platform_invite_sent: true,
      access_started: new Date().toISOString().split('T')[0],
    })
  }

  return new Response(JSON.stringify({ ok: true, action: 'updated', user_id: existingId }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  })
})
