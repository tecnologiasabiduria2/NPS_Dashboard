// Emisor genérico de webhooks SALIENTES hacia GHL (calibración 2026-07-09,
// llamada con Sebastián). WhatsApp no se conecta directo a la API de Meta —
// eso exigiría número verificado y plantillas propias del lado de la
// plataforma. En vez de eso, GHL ya tiene el número y las plantillas, así que
// el mecanismo es: la plataforma manda un webhook a la URL de un workflow de
// GHL (trigger "Webhook", configurado del lado de Juan), y GHL ejecuta la
// automatización (mandar la plantilla de WhatsApp ya aprobada).
//
// Esta función es intencionalmente genérica y sin caller todavía — no hay
// decisión de cuál disparador va primero (recordatorio de sesión, aviso de
// vencimiento, etc.) ni una URL real de un workflow para probar contra algo.
// Queda lista para conectarse en cuanto Juan arme el primer workflow en GHL
// y pase su URL de webhook.
export async function notifyGhlWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  if (!webhookUrl) {
    console.error('notifyGhlWebhook: falta la URL del webhook de GHL')
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('notifyGhlWebhook: GHL respondió con error', res.status, await res.text())
    }
  } catch (e) {
    console.error('notifyGhlWebhook: excepción al llamar al webhook de GHL', e instanceof Error ? e.message : String(e))
  }
}
