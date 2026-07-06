'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'

export default function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/admin/sessions?id=${sessionId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Sesión eliminada.')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? 'Error al eliminar. Intenta de nuevo.')
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
        >
          {loading ? 'Eliminando…' : 'Confirmar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded-md text-cream-muted hover:text-cream-dim transition-colors"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="shrink-0 p-1.5 rounded-md text-cream-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
      title="Eliminar sesión"
    >
      <Trash2 size={14} />
    </button>
  )
}
