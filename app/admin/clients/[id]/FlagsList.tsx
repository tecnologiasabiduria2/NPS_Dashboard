'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, Star } from 'lucide-react'
import { formatDateOnly } from '@/lib/format'
import { toast } from '@/lib/toast'

interface FlagRow {
  id: string
  type: string
  reason: string | null
  created_at: string
}

export default function FlagsList({ flags }: { flags: FlagRow[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function resolve(id: string) {
    setBusyId(id)
    setError('')
    const res = await fetch('/api/admin/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', flag_id: id }),
    })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const msg = data.error ?? 'Error al resolver.'
      setError(msg)
      toast.error(msg)
      return
    }
    toast.success('Resuelto.')
    router.refresh()
  }

  if (flags.length === 0) {
    return <p className="text-sm text-cream-muted">Sin banderas ni casos de éxito abiertos.</p>
  }

  return (
    <div className="space-y-2">
      {flags.map(f => {
        const esExito = f.type === 'caso_exito'
        return (
          <div key={f.id} className="flex items-start justify-between gap-3 rounded-lg bg-surface-800 p-3">
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 ${esExito ? 'text-emerald-400' : 'text-amber-400'}`}>
                {esExito ? <Star size={14} /> : <Flag size={14} />}
              </span>
              <div>
                <p className="text-sm text-cream">
                  {esExito ? 'Caso de éxito' : 'Bandera'}
                  <span className="text-xs text-cream-muted ml-2">{formatDateOnly(f.created_at?.slice(0, 10))}</span>
                </p>
                {f.reason && <p className="text-xs text-cream-dim mt-0.5">{f.reason}</p>}
              </div>
            </div>
            <button
              onClick={() => resolve(f.id)}
              disabled={busyId === f.id}
              className="btn-ghost text-xs shrink-0"
            >
              {busyId === f.id ? '…' : 'Resolver'}
            </button>
          </div>
        )
      })}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
