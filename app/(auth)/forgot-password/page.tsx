'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="card text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-2">Revisa tu correo</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Enviamos un enlace a <strong className="text-zinc-200">{email}</strong>
        </p>
        <Link href="/login" className="text-brand-400 text-sm hover:text-brand-300">
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-zinc-100 mb-2">Recuperar contraseña</h2>
      <p className="text-zinc-500 text-sm mb-6">Te enviamos un enlace para crear una nueva contraseña</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Enviando...' : 'Enviar enlace'}
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-400">
          Volver al login
        </Link>
      </div>
    </div>
  )
}
