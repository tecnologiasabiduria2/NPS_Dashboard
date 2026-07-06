'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Pause, Flag, Star } from 'lucide-react'
import { toast } from '@/lib/toast'

interface Props {
  userId: string
  productId: string | null
  hiperfocos: { id: string; title: string }[]
}

type Panel = 'cambiar' | 'pausa' | 'bandera' | 'exito' | null

export default function HiperfocoActions({ userId, productId, hiperfocos }: Props) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>(null)
  const [hiperfocoId, setHiperfocoId] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setPanel(null)
    setHiperfocoId('')
    setReason('')
    setError('')
  }

  async function post(url: string, payload: any, successMsg: string) {
    setLoading(true)
    setError('')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const msg = data.error ?? 'Error al guardar.'
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success(successMsg)
    reset()
    router.refresh()
  }

  const setHiperfoco = () =>
    post('/api/admin/hiperfoco', { user_id: userId, product_id: productId, action: 'set', hiperfoco_id: hiperfocoId }, 'Hiperfoco asignado.')
  const marcarPausa = () =>
    post('/api/admin/hiperfoco', { user_id: userId, product_id: productId, action: 'pausa' }, 'Mes marcado en pausa.')
  const levantarBandera = () =>
    post('/api/admin/flags', { action: 'raise', user_id: userId, product_id: productId, type: 'bandera', reason }, 'Bandera levantada.')
  const marcarExito = () =>
    post('/api/admin/flags', { action: 'raise', user_id: userId, product_id: productId, type: 'caso_exito', reason }, 'Caso de éxito registrado.')

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setPanel(panel === 'cambiar' ? null : 'cambiar')} className="btn-secondary justify-center text-sm">
          <ArrowRight size={14} /> Cambiar hiperfoco
        </button>
        <button onClick={() => setPanel(panel === 'pausa' ? null : 'pausa')} className="btn-secondary justify-center text-sm">
          <Pause size={14} /> Marcar pausa
        </button>
        <button onClick={() => setPanel(panel === 'bandera' ? null : 'bandera')} className="btn-secondary justify-center text-sm">
          <Flag size={14} /> Levantar bandera
        </button>
        <button onClick={() => setPanel(panel === 'exito' ? null : 'exito')} className="btn-secondary justify-center text-sm">
          <Star size={14} /> Marcar caso éxito
        </button>
      </div>

      {panel && (
        <div className="mt-3 rounded-lg border border-surface-700 bg-surface-800/50 p-4">
          {panel === 'cambiar' && (
            <div className="space-y-3">
              <label className="label">Hiperfoco para este mes</label>
              <select className="input" value={hiperfocoId} onChange={e => setHiperfocoId(e.target.value)}>
                <option value="">Selecciona…</option>
                {hiperfocos.map(h => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </select>
              <p className="text-xs text-cream-muted">Se asigna al mes en curso. El cliente solo lo visualiza.</p>
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="btn-secondary text-sm">Cancelar</button>
                <button onClick={setHiperfoco} disabled={loading || !hiperfocoId} className="btn-primary text-sm">
                  {loading ? 'Guardando…' : 'Asignar'}
                </button>
              </div>
            </div>
          )}

          {panel === 'pausa' && (
            <div className="space-y-3">
              <p className="text-sm text-cream-dim">¿Marcar el mes en curso como <span className="font-medium">pausa</span>? El hiperfoco del mes quedará en descanso.</p>
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="btn-secondary text-sm">Cancelar</button>
                <button onClick={marcarPausa} disabled={loading} className="btn-primary text-sm">
                  {loading ? 'Guardando…' : 'Marcar pausa'}
                </button>
              </div>
            </div>
          )}

          {(panel === 'bandera' || panel === 'exito') && (
            <div className="space-y-3">
              <label className="label">
                {panel === 'bandera' ? 'Motivo de la bandera' : 'Nota del caso de éxito (opcional)'}
              </label>
              <textarea
                className="input min-h-20 resize-y"
                placeholder={panel === 'bandera' ? 'Ej. socio no alineado con la expansión…' : 'Ej. duplicó ventas tras el embudo…'}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="btn-secondary text-sm">Cancelar</button>
                <button
                  onClick={panel === 'bandera' ? levantarBandera : marcarExito}
                  disabled={loading || (panel === 'bandera' && !reason.trim())}
                  className="btn-primary text-sm"
                >
                  {loading ? 'Guardando…' : panel === 'bandera' ? 'Levantar bandera' : 'Marcar caso éxito'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      )}
    </div>
  )
}
