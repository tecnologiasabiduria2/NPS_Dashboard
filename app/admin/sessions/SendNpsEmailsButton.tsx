'use client'

import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'

// Dispara a mano el envío de correos NPS (misma lógica que el cron agendado).
// Sirve para probar el flujo y para forzar un reenvío sin esperar al cron.
export default function SendNpsEmailsButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/send-nps-emails', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult(data.error ?? 'Error al enviar')
      } else {
        setResult(
          `${data.sessionsProcessed} sesión(es) revisada(s) · ${data.emailsSent} correo(s) enviado(s)` +
          (data.emailsFailed > 0 ? ` · ${data.emailsFailed} fallido(s)` : '')
        )
      }
    } catch {
      setResult('Error de red al enviar')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button type="button" onClick={run} disabled={loading} className="btn-secondary flex items-center gap-2">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
        Enviar recordatorios NPS pendientes
      </button>
      {result && <p className="text-xs text-cream-muted">{result}</p>}
    </div>
  )
}
