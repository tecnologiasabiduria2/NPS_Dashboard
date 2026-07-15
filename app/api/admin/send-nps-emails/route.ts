import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

// DESACTIVADO (2026-07-14, junto con /api/cron/send-nps-emails): el botón que
// llamaba a este endpoint se quitó de /admin/sessions. Se deja el endpoint
// devolviendo "disabled" en vez de borrar el archivo, por si se reactiva.
export async function POST() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  return NextResponse.json({ ok: true, disabled: true })
}
