'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { TOAST_EVENT, type ToastPayload } from '@/lib/toast'

interface Item extends ToastPayload {
  id: number
}

let counter = 0

export default function ToastContainer() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastPayload>).detail
      const id = ++counter
      setItems(prev => [...prev, { ...detail, id }])
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 4000)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          role="status"
          className={`animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm ${
            item.kind === 'success'
              ? 'bg-emerald-950/95 border-emerald-600/30 text-emerald-300'
              : 'bg-red-950/95 border-red-600/30 text-red-300'
          }`}
        >
          {item.kind === 'success'
            ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            : <XCircle size={16} className="shrink-0 mt-0.5" />}
          <p className="text-sm flex-1">{item.message}</p>
          <button
            onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
