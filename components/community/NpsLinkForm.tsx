'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { clsx } from 'clsx'
import type { NpsCopy } from '@/lib/nps'

interface Props {
  token: string
  sessionId: string
  sessionTitle: string
  copy: NpsCopy
  // Nombre del cliente si abre el link logueado → se atribuye sin pedir correo.
  loggedInName: string | null
}

// Overlay de NPS por link (Bloque 5b). Página pública: el mentor manda el link
// al terminar la clase. Colores por tono: detractor (1-6) rojo, pasivo (7-8)
// ámbar, promotor (9-10) verde.
export default function NpsLinkForm({ token, sessionId, sessionTitle, copy, loggedInName }: Props) {
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [already, setAlready] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Recordar el correo entre distintos links de NPS en el mismo navegador (pedido
  // de Diana, 2026-07-03) — más confiable que depender del autocompletado nativo,
  // que no siempre funciona en incógnito o en algunos celulares.
  useEffect(() => {
    if (loggedInName) return
    try {
      const saved = localStorage.getItem('nps-email')
      if (saved) setEmail(saved)
    } catch {}
  }, [loggedInName])

  const titleText = copy.title.replace('{sesion}', sessionTitle)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSubmit = score !== null && (!!loggedInName || emailValid)

  function scoreClass(n: number, selected: boolean) {
    if (!selected) return 'bg-surface-800 text-cream-dim hover:bg-surface-700 hover:text-cream'
    if (n <= 6) return 'bg-red-500 text-white ring-2 ring-red-300/40'
    if (n <= 8) return 'bg-amber-500 text-surface-950 ring-2 ring-amber-300/40'
    return 'bg-emerald-500 text-white ring-2 ring-emerald-300/40'
  }

  async function submit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      if (!loggedInName) {
        try { localStorage.setItem('nps-email', email.trim()) } catch {}
      }
      // Cliente logueado → /api/nps (atribuye por sesión, deriva hiperfoco).
      // Anónimo → /api/nps/public con correo opcional.
      const res = loggedInName
        ? await fetch('/api/nps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score, feedback, trigger: 'post_sesion', live_session_id: sessionId }),
          })
        : await fetch('/api/nps/public', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, score, feedback, email }),
          })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(d.error ?? 'No se pudo enviar')
      }
      setAlready(!!d.already)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-950">
      <div className="w-full max-w-md card">
        <div className="flex justify-center mb-6">
          <Image src="/logo-horizontal.png" alt="Sabiduría Empresarial" width={170} height={44} className="object-contain" priority />
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15">
              <Star size={22} className="text-accent" fill="#DA7D41" />
            </div>
            <p className="text-cream font-medium">
              {already ? 'Ya teníamos tu calificación' : '¡Gracias por tu respuesta!'}
            </p>
            <p className="text-cream-muted text-sm mt-1">
              {already ? 'Registramos tu opinión de esta sesión anteriormente.' : 'Tu opinión nos ayuda a mejorar cada sesión.'}
            </p>
            <p className="text-cream-muted text-sm mt-3">Ya puedes cerrar esta pestaña.</p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-accent font-medium mb-2 text-center">{copy.eyebrow}</p>
            <h1 className="text-xl font-semibold text-cream leading-snug text-center">{titleText}</h1>
            <p className="text-sm text-cream-dim mt-2 text-center">{copy.question}</p>

            {/* Escala 1-10 */}
            <div className="mt-6 grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={clsx('aspect-square rounded-lg text-sm font-semibold transition-all', scoreClass(n, score === n))}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-cream-muted uppercase tracking-wide">
              <span>Nada probable</span>
              <span>Muy probable</span>
            </div>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="¿Algo que quieras contarnos? (opcional)"
              rows={3}
              className="input mt-4 resize-none"
            />

            {loggedInName ? (
              <p className="text-[11px] text-cream-muted mt-3">
                Calificando como <span className="text-cream-dim">{loggedInName}</span>.
              </p>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu correo"
                  autoComplete="email"
                  className="input mt-3"
                />
                <p className="text-[11px] text-cream-muted mt-1.5">
                  Necesitamos tu correo para asociar tu respuesta a tu proceso.
                </p>
              </>
            )}

            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="btn-primary w-full justify-center mt-5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando…' : 'Enviar calificación'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
