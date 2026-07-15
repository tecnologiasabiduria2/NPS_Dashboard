import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Notificaciones del cliente autenticado (2026-07-15, Fase 6). Usa el cliente
// normal (RLS "own"), no supabaseAdmin — cada usuario solo puede ver/marcar
// las suyas, sin necesitar filtrar por user_id a mano (lo hace la policy).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Conteo de no leídas aparte (2026-07-16, fix): contarlas solo dentro de las
  // 30 más recientes subestimaba el badge si alguien acumulaba más de 30 sin
  // leer — un count exacto no depende de cuántas se muestran en la lista.
  const [{ data, error }, { count, error: countErr }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })

  return NextResponse.json({ notifications: data ?? [], unreadCount: count ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = Array.isArray(body?.ids) && body.ids.length > 0 ? body.ids : undefined

  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (ids) query = query.in('id', ids)
  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
