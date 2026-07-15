import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// NPS automático por correo — DESACTIVADO (2026-07-14, a pedido de Juan).
// Redundante: el link de NPS (/nps/{token}) ya se manda junto con la sesión
// al crearla, así que este envío automático por separado no aporta nada.
// Se deja el endpoint respondiendo 200 sin hacer nada (en vez de borrarlo) para
// que, si el crontab del VPS lo sigue llamando, no genere error 404/500 en
// los logs. La lógica real sigue intacta en lib/npsEmail.ts por si se
// reactiva más adelante. Recordar quitar la entrada del crontab del VPS
// cuando se despliegue este cambio.
// ============================================================================

export async function POST(req: NextRequest) {
  return NextResponse.json({ ok: true, disabled: true })
}
export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: true, disabled: true })
}
