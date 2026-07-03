import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const TRANSVERSAL_TIPOS = ['sala_gerencia', 'entrenamiento_comercial']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  // El path por si solo no basta: hay que confirmar que el usuario tiene acceso
  // activo al producto/hiperfoco de la grabacion dueña de ese path (no confiar
  // solo en que RLS/UI ya lo filtraron antes de llegar aqui).
  const { data: rec } = await supabaseAdmin
    .from('recordings')
    .select('tipo, hiperfoco_id, is_published, hiperfocos(product_id)')
    .eq('storage_path', path)
    .eq('is_published', true)
    .single()

  const hf = (rec as any)?.hiperfocos
  if (!rec || !hf) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const { data: access } = await supabaseAdmin
    .from('user_access')
    .select('product_id')
    .eq('user_id', user.id)
    .eq('product_id', hf.product_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!TRANSVERSAL_TIPOS.includes((rec as any).tipo)) {
    const { data: uhm } = await supabaseAdmin
      .from('user_hiperfoco_mes')
      .select('id')
      .eq('user_id', user.id)
      .eq('hiperfoco_id', (rec as any).hiperfoco_id)
      .maybeSingle()

    if (!uhm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('content')
    .createSignedUrl(path, 60)

  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return NextResponse.redirect(data.signedUrl)
}
