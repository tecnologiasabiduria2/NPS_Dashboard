import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqualStr } from '@/lib/timingSafeEqual'
import { runNpsEmailBatch } from '@/lib/npsEmail'

// ============================================================================
// NPS automático por correo (2026-07-03)
// Antes, el link de NPS post-sesión (/nps/{token}) solo se mandaba si el mentor
// lo copiaba a mano desde /admin/sessions y lo enviaba uno por uno. Este cron
// automatiza ese envío por correo a los asistentes reales de cada sesión.
// (La misma lógica también se puede disparar a mano desde /admin/sessions,
// botón "Enviar recordatorios NPS" → /api/admin/send-nps-emails.)
//
// Corre cada rato (ej. cada 30-60 min). Lo dispara el crontab del VPS con un
// curl al endpoint, protegido por CRON_SECRET (mismo patrón que sync-ghl):
//
//   crontab del VPS (ejemplo, cada 30 min):
//     */30 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" \
//       https://vip.sabiduriaempresarial.com/api/cron/send-nps-emails > /dev/null
// ============================================================================

export async function POST(req: NextRequest) {
  return run(req)
}
export async function GET(req: NextRequest) {
  return run(req)
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado.' }, { status: 501 })
  }
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (!timingSafeEqualStr(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runNpsEmailBatch()
  if (!result.configured) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY / RESEND_FROM_EMAIL no configuradas — no se puede mandar correo.' },
      { status: 501 }
    )
  }

  return NextResponse.json(result)
}
