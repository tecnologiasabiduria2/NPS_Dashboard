import { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Mentores: registros livianos sin cuenta de acceso (calibración 2026-07-07
// noche). Crear/editar nombre o activar/desactivar. Solo el owner.
export async function POST(req: NextRequest) {
  const auth = await requireOwner()
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const id: string | undefined = body?.id || undefined
  const nombre: string = (body?.nombre ?? '').trim()
  const activo = body?.activo !== false

  if (!nombre) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  if (id) {
    const { error } = await supabaseAdmin
      .from('mentores')
      .update({ nombre, activo })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, updated: true })
  }

  const { data, error } = await supabaseAdmin
    .from('mentores')
    .insert({ nombre, activo })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, created: true, id: data?.id })
}
