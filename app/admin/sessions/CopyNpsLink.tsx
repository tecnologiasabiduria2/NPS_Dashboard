'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'

// Copia el link público de NPS de una sesión (/nps/{token}) para que el mentor
// lo mande al terminar la clase. Bloque 5b.
export default function CopyNpsLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = `${window.location.origin}/nps/${token}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback si el navegador bloquea el portapapeles.
      window.prompt('Copia el link del NPS:', url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar link de NPS de esta sesión"
      aria-label="Copiar link de NPS"
      className="p-1.5 rounded-lg text-cream-muted hover:text-accent hover:bg-surface-700 transition-colors"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
    </button>
  )
}
