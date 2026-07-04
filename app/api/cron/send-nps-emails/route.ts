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
//
// 2026-07-03 (noche): con pocos clientes, mandar los correos y ESPERAR la
// respuesta no se notaba. Con más volumen, nginx llegó a cortar la conexión
// por tardanza (timeout) — el trabajo probablemente seguía corriendo igual,
// pero es frágil. Ahora este endpoint responde de inmediato ("started") y el
// envío real sigue en segundo plano; el resultado queda en los logs del
// servicio (journalctl -u ventra-platform), no en la respuesta HTTP.
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

  // Fire-and-forget: no se espera el resultado antes de responder.
  runNpsEmailBatch()
    .then(result => {
      if (!result.configured) {
        console.error('[cron/send-nps-emails] RESEND_API_KEY / RESEND_FROM_EMAIL no configuradas')
      } else {
        console.log('[cron/send-nps-emails]', JSON.stringify(result))
      }
    })
    .catch(err => console.error('[cron/send-nps-emails] fallo:', err))

  return NextResponse.json({ ok: true, started: true })
}
