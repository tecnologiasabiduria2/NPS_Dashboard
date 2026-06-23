import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// ESTRUCTURA PREPARADA — INTEGRACIÓN PAUSADA por instrucción explícita.
// Ver PENDIENTES.md A3. No conectar a ningún flujo de negocio (crear/activar
// accesos, etc.) hasta recibir la señal para hacerlo.
//
// Cuando se active habrá que:
//   1) `npm i stripe`
//   2) configurar STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET (.env)
//   3) verificar la firma con stripe.webhooks.constructEvent(rawBody, sig, secret)
//      — para eso leer el cuerpo CRUDO con `await req.text()` (no req.json()).
// ============================================================================

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  // Mientras la integración esté pausada, las keys no están configuradas →
  // la ruta existe pero no procesa nada.
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe no está configurado — integración pausada' },
      { status: 501 }
    )
  }

  // TODO (al activar): verificar firma del webhook con el SDK de Stripe antes de confiar en el evento.
  const event = await req.json().catch(() => null)
  if (!event?.type) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // Eventos esperados (sin lógica de negocio todavía — solo el esqueleto).
  switch (event.type) {
    case 'checkout.session.completed':
      // TODO: crear/activar user_access tras un pago exitoso.
      break
    case 'customer.subscription.updated':
      // TODO: sincronizar el estado/vigencia del acceso.
      break
    case 'customer.subscription.deleted':
      // TODO: desactivar el acceso al cancelarse la suscripción.
      break
    default:
      // Evento no manejado por ahora.
      break
  }

  return NextResponse.json({ received: true })
}
