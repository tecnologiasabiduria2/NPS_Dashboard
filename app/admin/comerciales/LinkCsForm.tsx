'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface LocalProfile {
  id: string
  full_name: string
  role: string
}

// Select que vincula un usuario de GHL con un profile local (CS). Al cambiar,
// hace POST y refresca. El profile seleccionado = el que tiene este ghl_user_id.
export default function LinkCsForm({
  ghlUserId,
  profiles,
  currentProfileId,
}: {
  ghlUserId: string
  profiles: LocalProfile[]
  currentProfileId: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onChange(profile_id: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/comerciales/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghl_user_id: ghlUserId, profile_id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al vincular')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al vincular')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        className="select w-full"
        defaultValue={currentProfileId}
        disabled={saving}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— Sin vincular —</option>
        {profiles.map(p => (
          <option key={p.id} value={p.id}>
            {p.full_name}{p.role === 'owner' ? ' (owner)' : ''}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
