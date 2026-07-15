import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { MONEDA_CODES, MONEDA_DEFAULT } from '@/lib/monedas'

// Métricas de negocio del cliente (punto 9 Fase 2): facturación real + objetivo
// del mes actual. Upsert por (user_id, periodo). Usado por el overlay privado de
// onboarding y por el pop-up mensual (mismo endpoint, misma fila del mes).
function parseMonto(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const digits = String(v).replace(/[^\d]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const facturacionReal = parseMonto(body.facturacion_real)
  const objetivo = parseMonto(body.objetivo)
  if (facturacionReal === null && objetivo === null) {
    return NextResponse.json({ error: 'No hay nada que guardar' }, { status: 400 })
  }
  const moneda = (typeof body.moneda === 'string' && MONEDA_CODES.includes(body.moneda)) ? body.moneda : MONEDA_DEFAULT

  const { data: acc } = await supabaseAdmin
    .from('user_access')
    .select('product_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  const productId = (acc as { product_id: string }[] | null)?.[0]?.product_id ?? null

  const now = new Date()
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const row: Record<string, unknown> = {
    user_id: user.id,
    product_id: productId,
    periodo,
    moneda,
    updated_at: new Date().toISOString(),
  }
  if (facturacionReal !== null) row.facturacion_real = facturacionReal
  if (objetivo !== null) row.objetivo = objetivo

  const { error } = await supabaseAdmin
    .from('user_metricas_mes')
    .upsert(row, { onConflict: 'user_id,periodo' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
