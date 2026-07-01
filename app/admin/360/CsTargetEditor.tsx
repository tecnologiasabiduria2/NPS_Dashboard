'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'

// B13 — edición inline del objetivo de sesiones 1:1 por CS/mes (solo owner).
export default function CsTargetEditor({ value }: { value: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'cs_session_target_monthly', value: val }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error ?? 'No se pudo guardar')
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setVal(String(value)); setEditing(true) }}
        className="text-xs text-cream-dim hover:text-cream inline-flex items-center gap-1.5 transition-colors"
      >
        Objetivo: {value} por CS / mes
        <Pencil size={12} />
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-xs text-cream-dim">Objetivo:</span>
      <input
        type="number"
        min={1}
        max={200}
        value={val}
        onChange={e => setVal(e.target.value)}
        autoFocus
        className="w-16 px-2 py-1 rounded-lg bg-surface-800 border border-surface-700 text-cream text-xs text-center focus:outline-none focus:border-brand-600"
      />
      <span className="text-xs text-cream-dim">por CS / mes</span>
      <button onClick={save} disabled={saving} className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50" aria-label="Guardar">
        <Check size={14} />
      </button>
      <button onClick={() => { setEditing(false); setErr(null) }} className="p-1 rounded-lg text-cream-muted hover:bg-surface-800" aria-label="Cancelar">
        <X size={14} />
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  )
}
