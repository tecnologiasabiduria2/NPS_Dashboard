'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('El enlace expiró. Solicita uno nuevo.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-zinc-100 mb-6">Nueva contraseña</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nueva contraseña</label>
          <input type="password" className="input" placeholder="Mínimo 8 caracteres"
            value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="label">Confirmar contraseña</label>
          <input type="password" className="input" placeholder="Repite la contraseña"
            value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}
