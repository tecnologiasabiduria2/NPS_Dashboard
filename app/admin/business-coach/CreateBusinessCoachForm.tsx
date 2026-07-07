'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { toast } from '@/lib/toast'

// Invitar un nuevo Business Coach (calibración 2026-07-07 noche: escalar a 2+).
export default function CreateBusinessCoachForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData()
    form.set('email', email)
    form.set('full_name', fullName)
    if (avatar) form.set('avatar', avatar)

    const res = await fetch('/api/admin/business-coach', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      const msg = data.error ?? 'No se pudo crear el Business Coach'
      setError(msg); toast.error(msg); return
    }
    toast.success('Business Coach invitado — recibirá un correo para activar su cuenta.')
    setOpen(false); setEmail(''); setFullName(''); setAvatar(null)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <UserPlus size={16} /> Crear Business Coach
      </button>
    )
  }

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-cream">Crear Business Coach</p>
        <button onClick={() => setOpen(false)} className="text-cream-muted hover:text-cream" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input type="text" className="input" placeholder="Nombre completo" value={fullName} onChange={e => setFullName(e.target.value)} required />
        <input type="email" className="input" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="file" accept="image/*" className="input" onChange={e => setAvatar(e.target.files?.[0] ?? null)} />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Invitando...' : 'Invitar'}
          </button>
        </div>
      </form>
    </div>
  )
}
