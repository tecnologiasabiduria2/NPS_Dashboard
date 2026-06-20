'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ActivateForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Supabase maneja el token automáticamente desde la URL
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { full_name: name },
    })

    if (updateError) {
      setError('Error al activar la cuenta. El link puede haber expirado.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-zinc-100 mb-2">Activar cuenta</h2>
      <p className="text-zinc-500 text-sm mb-6">Completa tu perfil para acceder a la plataforma</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Nombre completo</label>
          <input
            type="text"
            className="input"
            placeholder="Tu nombre"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <input
            type="password"
            className="input"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Confirmar contraseña</label>
          <input
            type="password"
            className="input"
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Activando...' : 'Activar cuenta'}
        </button>
      </form>
    </div>
  )
}

export default function ActivatePage() {
  return (
    <Suspense fallback={<div className="card text-zinc-400">Cargando...</div>}>
      <ActivateForm />
    </Suspense>
  )
}
