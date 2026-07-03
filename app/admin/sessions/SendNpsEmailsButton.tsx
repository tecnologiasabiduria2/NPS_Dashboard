'use client'

import { useState } from 'react'
import { Mail, Loader2 } from 'lucide-react'

interface Pending {
  sessionsCount: number
  recipientsCount: number
}

// Dispara a mano el envío de correos NPS (misma lógica que el cron agendado).
// Sirve para probar el flujo y para forzar un reenvío sin esperar al cron.
export default function SendNpsEmailsButton({ initialPending }: { initialPending: Pending }) {
  const [pending, setPending] = useState(initialPending)
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
        setPending({ sessionsCount: 0, recipientsCount: 0 })
      }
    } catch {
      setResult('Error de red al enviar')
    }
    setLoading(false)
  }

  const label = pending.recipientsCount > 0
    ? `Enviar recordatorios NPS pendientes (${pending.recipientsCount})`
    : 'Enviar recordatorios NPS pendientes'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={loading || pending.recipientsCount === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
          {label}
        </button>
        {result && <p className="text-xs text-cream-muted">{result}</p>}
      </div>
      {!result && (
        <p className="text-xs text-cream-muted">
          {pending.recipientsCount > 0
            ? `${pending.sessionsCount} sesión(es) con correos pendientes ahora mismo.`
            : 'Sin correos pendientes en este momento (el cron los manda solo cada 30 min).'}
        </p>
      )}
    </div>
  )
}
