'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Star } from 'lucide-react'
import { clsx } from 'clsx'
import type { NpsPrompt } from '@/lib/nps'

export default function NpsModal({ prompt }: { prompt: NpsPrompt }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Clave única por disparo: evita re-mostrar tras descartar/responder en esta sesión de navegador.
  const dismissKey = `nps-dismissed-${prompt.trigger}-${prompt.sessionId ?? 'semanal'}`

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(dismissKey)) return
    // Pequeño delay para no chocar con la carga de la página.
    const t = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(t)
  }, [dismissKey])

  function dismiss() {
    sessionStorage.setItem(dismissKey, '1')
    setOpen(false)
  }

  async function submit() {
    if (score === null || submitting) return
    setSubmitting(true)
    const res = await fetch('/api/nps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score,
        feedback,
        trigger: prompt.trigger,
        live_session_id: prompt.sessionId ?? null,
      }),
    })
    setSubmitting(false)
    if (!res.ok) return
    sessionStorage.setItem(dismissKey, '1')
    setDone(true)
    setTimeout(() => {
      setOpen(false)
      router.refresh()
    }, 1400)
  }

  if (!open) return null

  const copy = prompt.copy
  // {sesion} se reemplaza por el nombre de la sesión (solo aplica a post_sesion).
  const titleText = copy.title.replace('{sesion}', prompt.sessionTitle ?? 'tu última sesión')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl border border-surface-700 p-6 shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #1A1215 0%, #221518 100%)' }}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-cream-muted hover:text-cream transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        {done ? (
          <div className="py-8 text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: 'rgba(218,125,65,0.15)' }}
            >
              <Star size={22} className="text-accent" fill="#DA7D41" />
            </div>
            <p className="text-cream font-medium">¡Gracias por tu respuesta!</p>
            <p className="text-cream-muted text-sm mt-1">
              Tu opinión nos ayuda a mejorar.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent font-medium mb-2">
              {copy.eyebrow}
            </p>
            <h2 className="text-xl font-semibold text-cream leading-snug">
              {titleText}
            </h2>
            <p className="text-sm text-cream-dim mt-2">{copy.question}</p>

            {/* Escala 1-10 */}
            <div className="mt-5 grid grid-cols-10 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setScore(n)}
                  className={clsx(
                    'aspect-square rounded-lg text-sm font-medium transition-all',
                    score === n
                      ? 'bg-brand-600 text-cream ring-2 ring-accent'
                      : 'bg-surface-800 text-cream-dim hover:bg-surface-700 hover:text-cream'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-cream-muted uppercase tracking-wide">
              <span>Nada probable</span>
              <span>Muy probable</span>
            </div>

            {/* Feedback opcional */}
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="¿Algo que quieras contarnos? (opcional)"
              rows={3}
              className="input mt-4 resize-none"
            />

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={dismiss}
                className="btn-ghost"
                disabled={submitting}
              >
                Ahora no
              </button>
              <button
                onClick={submit}
                disabled={score === null || submitting}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
