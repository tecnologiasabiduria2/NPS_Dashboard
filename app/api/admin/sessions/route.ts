import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SESSION_TIPO_VALUES } from '@/lib/sessionTypes'

// Sala de Gerencia / Entrenamiento Comercial son tipos transversales (los ve
// cualquier cliente activo, sin importar hiperfoco/producto) — nunca deben
// quedar atados a un hiperfoco_nombre específico. Guard de defensa: aunque el
// formulario ya lo maneja bien, esto evita que una llamada directa a la API
// recree la inconsistencia que tenía la sesión "dsdq" (2026-07-15).
const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial']

// POST /api/admin/sessions — crea o actualiza una sesión en vivo
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const id: string | undefined = body?.id || undefined
  // Producto OPCIONAL (#8v2): vacío = todos los productos. Solo se usa para restringir.
  const product_id: string = (body?.product_id ?? '').trim()
  const title: string = (body?.title ?? '').trim() || 'Sesión en vivo'
  const tipo: string = body?.tipo
  const zoom_url: string = (body?.zoom_url ?? '').trim()
  const starts_at: string = body?.starts_at
  const ends_at: string = body?.ends_at
  const is_published = !!body?.is_published
  const descripcion: string = (body?.descripcion ?? '').trim()
  // Hiperfoco por NOMBRE (#8v2): vacío = General (la ven todos). Con valor, la ven
  // solo los clientes con un hiperfoco de ese nombre (cualquier producto).
  const hiperfoco_nombre: string = TRANSVERSAL_TIPOS.includes(tipo) ? '' : (body?.hiperfoco_nombre ?? '').trim()
  // Link recurrente: si viene, se guarda el link como el fijo de este tipo.
  const save_recurring = !!body?.save_recurring
  // 1:1 agendada (calibración 2026-07-07): audience='individual' + client_user_id.
  // El NPS post-sesión y el join genérico ya funcionan igual que en grupales.
  const audience: string = body?.audience === 'individual' ? 'individual' : 'grupal'
  const client_user_id: string | null = audience === 'individual' ? (body?.client_user_id || null) : null
  if (audience === 'individual' && !client_user_id) {
    return NextResponse.json({ error: 'Falta el cliente de la 1:1' }, { status: 400 })
  }

  // El link es OPCIONAL: las sesiones "variables" se crean sin link y el coach lo
  // pega después (mientras, el cliente ve "Link próximamente").
  if (!starts_at || !ends_at) {
    return NextResponse.json({ error: 'Inicio y fin son obligatorios' }, { status: 400 })
  }
  if (!SESSION_TIPO_VALUES.includes(tipo as any)) {
    return NextResponse.json({ error: 'Tipo de sesión inválido' }, { status: 400 })
  }
  if (new Date(ends_at).getTime() <= new Date(starts_at).getTime()) {
    return NextResponse.json({ error: 'La hora de fin debe ser posterior a la de inicio' }, { status: 400 })
  }

  // Si se restringió a un producto, debe existir.
  if (product_id) {
    const { data: product } = await supabaseAdmin.from('products').select('id').eq('id', product_id).single()
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 })
  }

  // Para una 1:1, el CS responsable es el Business Coach que la agenda
  // (corregido 2026-07-07 noche: el mentor de hiperfoco no tiene cuenta ni
  // hace 1:1, solo dicta la clase grupal).
  const cs_id: string | null = audience === 'individual' ? auth.user.id : null

  const payload: Record<string, any> = {
    product_id: product_id || null, title, tipo, zoom_url, starts_at, ends_at, is_published,
    descripcion: descripcion || null, hiperfoco_nombre: hiperfoco_nombre || null,
    audience, client_user_id, cs_id,
    updated_at: new Date().toISOString(),
  }
  // Reintento resiliente si faltan columnas opcionales (migración no corrida):
  // primero sin hiperfoco_nombre, luego además sin descripcion.
  const stripHf = (p: Record<string, any>) => { const { hiperfoco_nombre: _h, ...rest } = p; return rest }
  const stripHfDesc = (p: Record<string, any>) => { const { hiperfoco_nombre: _h, descripcion: _d, ...rest } = p; return rest }

  // Guarda el link como el recurrente del tipo (para autocompletar la próxima).
  async function persistRecurring() {
    if (save_recurring && zoom_url) {
      await supabaseAdmin.from('platform_settings').upsert(
        { key: `zoom_link_${tipo}`, value: zoom_url, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }
  }

  if (id) {
    let { error } = await supabaseAdmin.from('live_sessions').update(payload).eq('id', id)
    if (error?.code === '42703') ({ error } = await supabaseAdmin.from('live_sessions').update(stripHf(payload)).eq('id', id))
    if (error?.code === '42703') ({ error } = await supabaseAdmin.from('live_sessions').update(stripHfDesc(payload)).eq('id', id))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await persistRecurring()
    return NextResponse.json({ ok: true, updated: true })
  }

  let { data, error } = await supabaseAdmin.from('live_sessions').insert(payload).select('id').single()
  if (error?.code === '42703') ({ data, error } = await supabaseAdmin.from('live_sessions').insert(stripHf(payload)).select('id').single())
  if (error?.code === '42703') ({ data, error } = await supabaseAdmin.from('live_sessions').insert(stripHfDesc(payload)).select('id').single())
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await persistRecurring()
  return NextResponse.json({ ok: true, created: true, id: data?.id })
}

// DELETE /api/admin/sessions?id=<uuid> — elimina una sesión
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('live_sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, deleted: true })
}
