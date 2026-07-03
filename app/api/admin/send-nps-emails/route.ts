import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runNpsEmailBatch } from '@/lib/npsEmail'

// Botón manual en /admin/sessions: dispara el mismo envío de correos NPS que
// el cron agendado, pero al instante (útil para probar o forzar un reenvío).
export async function POST() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const result = await runNpsEmailBatch()
  if (!result.configured) {
    return NextResponse.json(
      { error: 'Falta configurar RESEND_API_KEY / RESEND_FROM_EMAIL en el .env.' },
      { status: 501 }
    )
  }

  return NextResponse.json(result)
}
