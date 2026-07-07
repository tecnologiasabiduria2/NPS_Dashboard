'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

// Asignar/cambiar qué mentor dictó un hiperfoco en un mes dado (calibración
// 2026-07-06). Mismo patrón fetch+toast+router.refresh() que CsTargetEditor.tsx.
export default function HiperfocoMentorSelect({
  hiperfocoId,
  periodo,
  value,
  options,
}: {
  hiperfocoId: string
  periodo: string
  value: string
  options: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function change(mentorId: string) {
    setSaving(true)
    const res = await fetch('/api/admin/hiperfoco-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hiperfoco_id: hiperfocoId, periodo, mentor_id: mentorId }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error(j.error ?? 'No se pudo guardar')
      return
    }
    toast.success('Mentor actualizado.')
    router.refresh()
  }

  return (
    <select
      className="select w-auto text-xs py-1.5"
      value={value}
      disabled={saving}
      onChange={e => change(e.target.value)}
    >
      <option value="">Sin asignar</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  )
}
