'use client'

import { useState } from 'react'
import { LogIn, Check } from 'lucide-react'

// Copia el link de ACCESO de plataforma de una sesión (/api/sessions/{id}/join)
// para repartirlo en vez del Zoom directo. La plataforma valida acceso activo
// antes de redirigir al Meet; inactivo → paywall. Bloque 5c.
export default function CopyJoinLink({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}/api/sessions/${sessionId}/join`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copia el link de acceso (plataforma):', url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar link de ACCESO de plataforma (en vez del Zoom directo)"
      aria-label="Copiar link de acceso"
      className="p-1.5 rounded-lg text-cream-muted hover:text-accent hover:bg-surface-700 transition-colors"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <LogIn size={14} />}
    </button>
  )
}
