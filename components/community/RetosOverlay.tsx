'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { RetoPregunta } from '@/lib/retosPreguntas'
import { notifyOverlayClosed } from '@/lib/onboardingTour'

// Pop-up de "retos" al iniciar un hiperfoco/módulo (punto 9 Fase 2, 2026-07-14).
// Las preguntas llegan como prop (fetchRetoPreguntas en el layout, editables por
// admin en /admin/retos/questions) para el hiperfoco activo del mes. Descartable
// con "Ahora no".
export default function RetosOverlay({
  hiperfocoId,
  hiperfocoTitulo,
  preguntas,
}: {
  hiperfocoId: string
  hiperfocoTitulo: string
  preguntas: RetoPregunta[]
}) {
  const router = useRouter()
  // Clave por hiperfoco: descartar uno no descarta los demás.
  const dismissKey = `retos-dismissed-${hiperfocoId}`
  // 2026-07-16, fix real: el intento anterior de decidir "open" en el lazy init
  // del useState (leyendo sessionStorage antes de pintar) generaba un mismatch
  // de hidratación real — el servidor SIEMPRE asume open=true (no conoce el
  // sessionStorage del cliente), así que en cualquier carga posterior al primer
  // descarte, el cliente calculaba open=false desde el primer render mientras el
  // servidor había mandado el modal completo. React no reconciliaba ese árbol
  // (el botón quedaba con el HTML crudo del servidor, sin fiber de React
  // adjunto — sin verdaderos listeners), dejando un modal "fantasma" visible
  // pero muerto: ni "Ahora no" ni la X hacían nada. Fix: arrancar en `false`
  // (idéntico en servidor y cliente, sin mismatch) y decidir de verdad recién
  // en un useEffect post-montaje — sin el parpadeo "aparece y se cierra" que
  // el intento anterior quería evitar, porque acá nunca llega a aparecer si ya
  // estaba descartado.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!sessionStorage.getItem(dismissKey)) setOpen(true)
  }, [dismissKey])
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function dismiss() {
    try { sessionStorage.setItem(dismissKey, '1') } catch {}
    setOpen(false)
    notifyOverlayClosed()
  }

  async function submit() {
    if (Object.keys(respuestas).length === 0) {
      setError('Responde al menos una pregunta')
      return
    }
    setSaving(true); setError(null)
    const res = await fetch('/api/retos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hiperfoco_id: hiperfocoId, respuestas }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'No se pudo guardar')
      return
    }
    try { sessionStorage.setItem(dismissKey, '1') } catch {}
    setOpen(false)
    notifyOverlayClosed()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-full max-w-md card">
        <button onClick={dismiss} className="absolute top-4 right-4 text-cream-muted hover:text-cream" aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Target size={16} className="text-sand" />
          <p className="text-xs uppercase tracking-widest text-sand font-medium">Nuevo módulo</p>
        </div>
        <h2 className="text-xl font-semibold text-cream mb-1">Cuéntanos tu punto de partida</h2>
        <p className="text-sm text-cream-muted mb-5">
          Empiezas <span className="text-cream">{hiperfocoTitulo}</span>. Responde rápido para medir tu
          avance al terminar el módulo.
        </p>

        <div className="space-y-5">
          {preguntas.map(preg => (
            <div key={preg.id}>
              <p className="text-sm text-cream-dim mb-2">{preg.texto}</p>
              <div className="flex gap-1.5">
                {preg.opciones.map(op => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setRespuestas(r => ({ ...r, [preg.id]: op.value }))}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-colors border',
                      respuestas[preg.id] === op.value
                        ? 'bg-brand-600/20 text-brand-300 border-brand-600/40'
                        : 'bg-surface-800 text-cream-muted border-surface-700 hover:text-cream',
                    )}
                    title={op.label}
                  >
                    {op.value}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-cream-muted">{preg.opciones[0].label}</span>
                <span className="text-[10px] text-cream-muted">{preg.opciones[preg.opciones.length - 1].label}</span>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        <div className="flex items-center justify-end gap-3 mt-5">
          <button onClick={dismiss} className="btn-ghost" disabled={saving}>Ahora no</button>
          <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
