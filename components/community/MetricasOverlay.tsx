'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, X, TrendingUp } from 'lucide-react'
import { MONEDAS, MONEDA_DEFAULT } from '@/lib/monedas'
import { notifyOverlayClosed } from '@/lib/onboardingTour'

// Overlay PRIVADO de métricas de negocio (punto 9 Fase 2, 2026-07-14). Se muestra
// cuando el cliente aún no ha registrado su facturación/objetivo del mes actual
// (primera vez = onboarding; meses siguientes = pregunta mensual). Descartable
// con "Ahora no" (se oculta en la sesión de navegador actual). A diferencia del
// overlay de comunidad, aquí se recalca que los datos son privados de negocio.
function formatMonto(digits: string): string {
  const clean = digits.replace(/[^\d]/g, '')
  if (!clean) return ''
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export default function MetricasOverlay() {
  const router = useRouter()
  // 2026-07-16, fix real (mismo bug que RetosOverlay): el lazy init anterior
  // decidía open=false en el cliente cuando ya había sessionStorage, mientras
  // el servidor (que no conoce el sessionStorage del cliente) siempre mandaba
  // el modal completo — mismatch de hidratación real. React dejaba el modal
  // como HTML crudo sin fiber adjunto (ni "Ahora no" ni la X funcionaban,
  // aunque sessionStorage sí se actualizaba). Fix: arrancar en `false` en
  // ambos lados (sin mismatch) y decidir de verdad en un useEffect post-montaje.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!sessionStorage.getItem('metricas-dismissed')) setOpen(true)
  }, [])
  const [facturacion, setFacturacion] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [moneda, setMoneda] = useState(MONEDA_DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Recuerda la última moneda elegida por este cliente (rara vez cambia).
    try {
      const saved = localStorage.getItem('metricas-moneda')
      if (saved) setMoneda(saved)
    } catch {}
  }, [])

  if (!open) return null

  function dismiss() {
    try { sessionStorage.setItem('metricas-dismissed', '1') } catch {}
    setOpen(false)
    notifyOverlayClosed()
  }

  async function submit() {
    if (!facturacion.trim() && !objetivo.trim()) {
      setError('Completa al menos un campo')
      return
    }
    setSaving(true); setError(null)
    const res = await fetch('/api/metricas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facturacion_real: facturacion, objetivo, moneda }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'No se pudo guardar')
      return
    }
    try {
      sessionStorage.setItem('metricas-dismissed', '1')
      localStorage.setItem('metricas-moneda', moneda)
    } catch {}
    setOpen(false)
    notifyOverlayClosed()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-full max-w-md card max-h-[90vh] overflow-y-auto">
        <button onClick={dismiss} className="absolute top-4 right-4 text-cream-muted hover:text-cream" aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={16} className="text-sand" />
          <p className="text-xs uppercase tracking-widest text-sand font-medium">Tu negocio este mes</p>
        </div>
        <h2 className="text-xl font-semibold text-cream mb-1">Registra tu avance</h2>
        <p className="text-sm text-cream-muted mb-4">
          Con esto verás tu evolución y tus conquistas con números en "Mi progreso".
        </p>

        <div className="flex items-center gap-2 mb-4 rounded-lg bg-surface-800/60 border border-surface-700 px-3 py-2">
          <Lock size={13} className="text-cream-muted shrink-0" />
          <p className="text-xs text-cream-muted">
            Dato privado de tu negocio. Solo lo ven tú y tu equipo de acompañamiento.
          </p>
        </div>

        <label className="label">Moneda</label>
        <select value={moneda} onChange={e => setMoneda(e.target.value)} className="input mb-3">
          {MONEDAS.map(m => (
            <option key={m.code} value={m.code}>{m.label}</option>
          ))}
        </select>

        <label className="label">¿Cuál fue tu facturación este mes?</label>
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-muted text-sm">$</span>
          <input
            value={facturacion}
            onChange={e => setFacturacion(formatMonto(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            className="input pl-7"
          />
        </div>

        <label className="label">¿Cuál es tu objetivo para el próximo mes?</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-muted text-sm">$</span>
          <input
            value={objetivo}
            onChange={e => setObjetivo(formatMonto(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            className="input pl-7"
          />
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
