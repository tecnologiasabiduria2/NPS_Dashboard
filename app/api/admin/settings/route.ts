import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Ajustes de plataforma (B13). Solo el owner (Diana) los edita.
// Whitelist de claves permitidas + validación por clave, para no dejar
// escritura libre sobre la tabla key/value.
const ALLOWED: Record<string, (raw: string) => string | null> = {
  // Objetivo de sesiones 1:1 por CS/mes: entero 1..200.
  cs_session_target_monthly: (raw) => {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n) || n < 1 || n > 200) return null
    return String(n)
  },
}

export async function POST(req: Request) {
  const auth = await requireOwner()
  if ('error' in auth) return auth.error

  let body: { key?: string; value?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const key = body.key ?? ''
  const validator = ALLOWED[key]
  if (!validator) return NextResponse.json({ error: 'Clave no permitida' }, { status: 400 })

  const value = validator(String(body.value ?? ''))
  if (value === null) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, key, value })
}
